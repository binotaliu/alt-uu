import { and, eq } from 'drizzle-orm';
import { accountDailyActivities, playbackProgress } from '../../db/schema';
import type { AltUUDatabase } from '../../db/types';
import type { Clock } from '../../platform';
import type {
  AccountDailyActivityTransferItem,
  PlaybackProgressTransferItem,
} from './types';

/**
 * Shared upsert-by-natural-key merge used by the file import and (later) a
 * device sync pull, so both apply incoming rows identically.
 *
 * Last-write-wins: an incoming row is skipped only when both timestamps are
 * known and the local row is newer. Rows without a timestamp (the manual
 * import file) always overwrite.
 */
export async function mergeAccountData(
  deps: { db: AltUUDatabase; clock: Clock },
  playbackProgressItems: PlaybackProgressTransferItem[],
  accountDailyActivityItems: AccountDailyActivityTransferItem[],
  localAccountIdsByUsername: ReadonlyMap<string, number>,
): Promise<{
  importedPlaybackProgressCount: number;
  importedAccountDailyActivitiesCount: number;
}> {
  const { db, clock } = deps;
  let importedPlaybackProgressCount = 0;
  let importedAccountDailyActivitiesCount = 0;

  for (const item of playbackProgressItems) {
    const accountId = localAccountIdsByUsername.get(item.username);

    if (accountId === undefined) {
      continue;
    }

    const key = and(
      eq(playbackProgress.accountId, accountId),
      eq(playbackProgress.cid, item.cid),
      eq(playbackProgress.activityId, item.activityId),
    );
    const existing = (
      await db.select().from(playbackProgress).where(key).limit(1)
    )[0];

    if (
      existing !== undefined &&
      isIncomingStale(existing.updatedAt, item.updatedAt ?? null)
    ) {
      continue;
    }

    const now = clock.now();
    const values = {
      durationSeconds: item.durationSeconds,
      positionSeconds: item.positionSeconds,
      hunguUploadSuccess: item.hunguUploadSuccess,
      updatedAt: now,
    };

    if (existing === undefined) {
      await db.insert(playbackProgress).values({
        accountId,
        cid: item.cid,
        activityId: item.activityId,
        ...values,
        createdAt: now,
      });
    } else {
      await db
        .update(playbackProgress)
        .set(values)
        .where(eq(playbackProgress.id, existing.id));
    }

    importedPlaybackProgressCount += 1;
  }

  for (const item of accountDailyActivityItems) {
    const accountId = localAccountIdsByUsername.get(item.username);

    if (accountId === undefined) {
      continue;
    }

    const key = and(
      eq(accountDailyActivities.accountId, accountId),
      eq(accountDailyActivities.activityDate, item.activityDate),
    );
    const existing = (
      await db.select().from(accountDailyActivities).where(key).limit(1)
    )[0];

    if (
      existing !== undefined &&
      isIncomingStale(existing.updatedAt, item.updatedAt ?? null)
    ) {
      continue;
    }

    const now = clock.now();

    if (existing === undefined) {
      await db.insert(accountDailyActivities).values({
        accountId,
        activityDate: item.activityDate,
        totalSeconds: item.totalSeconds,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await db
        .update(accountDailyActivities)
        .set({ totalSeconds: item.totalSeconds, updatedAt: now })
        .where(eq(accountDailyActivities.id, existing.id));
    }

    importedAccountDailyActivitiesCount += 1;
  }

  return {
    importedPlaybackProgressCount,
    importedAccountDailyActivitiesCount,
  };
}

function isIncomingStale(
  existingUpdatedAt: Date | null,
  incomingUpdatedAt: string | null,
): boolean {
  if (existingUpdatedAt === null || incomingUpdatedAt === null) {
    return false;
  }

  const incoming = Date.parse(incomingUpdatedAt);

  if (Number.isNaN(incoming)) {
    return false;
  }

  // PHP getTimestamp() has second resolution.
  return (
    Math.floor(existingUpdatedAt.getTime() / 1000) > Math.floor(incoming / 1000)
  );
}
