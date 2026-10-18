import { and, asc, inArray, isNull } from 'drizzle-orm';
import {
  accountDailyActivities,
  accounts,
  playbackProgress,
} from '../../db/schema';
import type { AltUUDatabase } from '../../db/types';
import { isRecord, phpJsonEncode } from '../../http/encoding';
import type { Clock } from '../../platform';
import {
  PremiumRequiredError,
  ValidationError,
  type EntitlementChecker,
} from '../account/validation';
import { mergeAccountData } from './mergeAccountData';
import type {
  AccountDailyActivityTransferItem,
  DataExport,
  DataImportInput,
  DataImportResult,
  PlaybackProgressTransferItem,
} from './types';

export interface DataPortabilityServicesDeps {
  db: AltUUDatabase;
  clock: Clock;
  /** Import (not export) needs an active Alt UU+ entitlement. */
  isSubscriptionActive: EntitlementChecker;
}

/**
 * ExportAccountData / ImportAccountData with the JSON file format of the
 * legacy app, so existing export files keep importing.
 */
export function createDataPortabilityServices(
  deps: DataPortabilityServicesDeps,
) {
  const { db, clock } = deps;

  return {
    async exportData(): Promise<DataExport> {
      const accountRows = await db
        .select({ id: accounts.id, username: accounts.username })
        .from(accounts)
        .where(isNull(accounts.deletedAt))
        .orderBy(asc(accounts.id));
      const usernamesById = new Map(
        accountRows.map((row) => [row.id, row.username]),
      );
      const accountIds = [...usernamesById.keys()];

      const progressRows =
        accountIds.length === 0
          ? []
          : await db
              .select()
              .from(playbackProgress)
              .where(inArray(playbackProgress.accountId, accountIds))
              .orderBy(asc(playbackProgress.id));
      const activityRows =
        accountIds.length === 0
          ? []
          : await db
              .select()
              .from(accountDailyActivities)
              .where(inArray(accountDailyActivities.accountId, accountIds))
              .orderBy(asc(accountDailyActivities.id));

      return {
        exportedAt: toIso8601(clock.now()),
        accounts: Object.fromEntries(
          accountRows.map((row) => [row.username, row.id]),
        ),
        playbackProgress: progressRows.map((row) => ({
          username: usernamesById.get(row.accountId ?? -1) ?? '',
          cid: row.cid,
          activityId: row.activityId,
          durationSeconds: row.durationSeconds,
          positionSeconds: row.positionSeconds,
          hunguUploadSuccess: row.hunguUploadSuccess,
        })),
        accountDailyActivities: activityRows.map((row) => ({
          username: usernamesById.get(row.accountId) ?? '',
          activityDate: row.activityDate,
          totalSeconds: row.totalSeconds,
        })),
      };
    },

    /**
     * The export as the legacy file body: `json_encode` output, with an
     * empty `accounts` map written as `[]` like PHP does.
     */
    async exportFile(): Promise<{ fileName: string; contents: string }> {
      const data = await this.exportData();

      return {
        fileName: `alt-uu-data-export-${clock.now().toISOString().slice(0, 10)}.json`,
        contents: phpJsonEncode({
          ...data,
          accounts:
            Object.keys(data.accounts).length === 0 ? [] : data.accounts,
        }),
      };
    },

    /** Parses an export file's text and imports it. */
    async importFile(contents: string): Promise<DataImportResult> {
      let decoded: unknown;

      try {
        decoded = JSON.parse(contents);
      } catch {
        throw ValidationError.field('accounts', '匯入的檔案格式不正確。');
      }

      return this.importData(decoded as DataImportInput);
    },

    async importData(rawInput: DataImportInput): Promise<DataImportResult> {
      if (!(await deps.isSubscriptionActive())) {
        throw new PremiumRequiredError();
      }

      const input = validateImportInput(rawInput);
      const usernames = Object.keys(input.accounts);
      const localRows =
        usernames.length === 0
          ? []
          : await db
              .select({
                id: accounts.id,
                username: accounts.username,
              })
              .from(accounts)
              .where(
                and(
                  inArray(accounts.username, usernames),
                  isNull(accounts.deletedAt),
                ),
              );
      const localAccountIdsByUsername = new Map(
        localRows.map((row) => [row.username, row.id]),
      );
      const skippedUsernames = usernames.filter(
        (username) => !localAccountIdsByUsername.has(username),
      );

      const merged = await mergeAccountData(
        { db, clock },
        input.playbackProgress,
        input.accountDailyActivities,
        localAccountIdsByUsername,
      );

      return {
        importedAccountsCount: localAccountIdsByUsername.size,
        skippedUsernames,
        ...merged,
      };
    },
  };
}

export type DataPortabilityServices = ReturnType<
  typeof createDataPortabilityServices
>;

/** PHP `toIso8601String()` for a UTC app timezone. */
function toIso8601(date: Date): string {
  return `${date.toISOString().slice(0, 19)}+00:00`;
}

interface ValidatedImportInput {
  accounts: Record<string, unknown>;
  playbackProgress: PlaybackProgressTransferItem[];
  accountDailyActivities: AccountDailyActivityTransferItem[];
}

function validateImportInput(input: DataImportInput): ValidatedImportInput {
  if (!isRecord(input) || !isRecord(input.accounts)) {
    throw ValidationError.field('accounts', 'accounts 為必填。');
  }

  const errors: Record<string, string[]> = {};
  // Numeric usernames become integer keys in PHP; Object.keys gives strings either way.
  const accountMap = Array.isArray(input.accounts) ? {} : input.accounts;
  const progress = Array.isArray(input.playbackProgress)
    ? input.playbackProgress
    : [];
  const activities = Array.isArray(input.accountDailyActivities)
    ? input.accountDailyActivities
    : [];

  progress.forEach((item, index) => {
    const problem = playbackProgressProblem(item);

    if (problem !== null) {
      errors[`playbackProgress.${index}.${problem}`] = [`${problem} 不正確。`];
    }
  });
  activities.forEach((item, index) => {
    const problem = dailyActivityProblem(item);

    if (problem !== null) {
      errors[`accountDailyActivities.${index}.${problem}`] = [
        `${problem} 不正確。`,
      ];
    }
  });

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }

  return {
    accounts: accountMap,
    playbackProgress: progress,
    accountDailyActivities: activities,
  };
}

function playbackProgressProblem(item: unknown): string | null {
  if (!isRecord(item)) {
    return 'username';
  }

  const row = item as Record<string, unknown>;

  if (typeof row.username !== 'string' || row.username === '') {
    return 'username';
  }

  if (
    typeof row.cid !== 'string' ||
    row.cid === '' ||
    [...row.cid].length > 64
  ) {
    return 'cid';
  }

  if (
    typeof row.activityId !== 'string' ||
    row.activityId === '' ||
    [...row.activityId].length > 191
  ) {
    return 'activityId';
  }

  if (!isNonNegativeInteger(row.durationSeconds)) {
    return 'durationSeconds';
  }

  if (
    typeof row.positionSeconds !== 'number' ||
    !Number.isFinite(row.positionSeconds) ||
    row.positionSeconds < 0
  ) {
    return 'positionSeconds';
  }

  if (
    row.hunguUploadSuccess !== null &&
    row.hunguUploadSuccess !== undefined &&
    typeof row.hunguUploadSuccess !== 'boolean'
  ) {
    return 'hunguUploadSuccess';
  }

  return null;
}

function dailyActivityProblem(item: unknown): string | null {
  if (!isRecord(item)) {
    return 'username';
  }

  const row = item as Record<string, unknown>;

  if (typeof row.username !== 'string' || row.username === '') {
    return 'username';
  }

  if (typeof row.activityDate !== 'string' || !isYmd(row.activityDate)) {
    return 'activityDate';
  }

  if (!isNonNegativeInteger(row.totalSeconds)) {
    return 'totalSeconds';
  }

  return null;
}

function isNonNegativeInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isYmd(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (match === null) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
