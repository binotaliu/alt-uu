import { sql } from 'drizzle-orm';
import { fromLegacySession } from '../accounts/legacySessionMapping';
import type { CredentialCipher } from '../db/cipher';
import {
  accountDailyActivities,
  accounts,
  blockedContents,
  blockedUsers,
  keyValueStore,
  playbackProgress,
} from '../db/schema';
import type { AltUUDatabase } from '../db/types';
import type { Clock } from '../platform';
import { LEGACY_ACTIVE_PROFILE_KEY } from './legacyReader';
import type {
  LegacyAccount,
  LegacyImportSummary,
  LegacySnapshot,
} from './types';

/**
 * Cipher purposes used by AccountCredentialsStore / EncryptedSessionStore.
 * Tests read the imported rows back through those stores to keep these in
 * sync.
 */
const PASSWORD_PURPOSE = 'accounts.password';
const HUNGU_SESSION_PURPOSE = 'accounts.hungu_session';
const SCHOOL_PORTAL_SESSION_PURPOSE = 'accounts.school_portal_session';

export interface LegacyImportDeps {
  db: AltUUDatabase;
  cipher: CredentialCipher;
  clock: Clock;
}

export interface LegacyImportOptions {
  /** Written inside the import transaction, so success is atomic. */
  completionMarker?: { key: string; value: string };
}

interface PreparedAccount {
  legacy: LegacyAccount;
  password: string | null;
  hunguSession: string | null;
  schoolPortalSession: string | null;
}

/**
 * Writes a decrypted legacy snapshot into the new schema inside one
 * transaction (all or nothing, so a failed attempt is safe to retry).
 *
 * Account ids are preserved when free, so foreign keys and the active
 * profile line up. Rows that already exist in the new database win: an
 * account with the same username is reused untouched and every other
 * table is inserted with ON CONFLICT DO NOTHING.
 */
export async function importLegacySnapshot(
  deps: LegacyImportDeps,
  snapshot: LegacySnapshot,
  options: LegacyImportOptions = {},
): Promise<LegacyImportSummary> {
  const { db, clock } = deps;
  const now = clock.now();
  // Encryption is async (the data key lives in secure storage), so it
  // happens before the transaction opens.
  const prepared = await prepareAccounts(deps.cipher, snapshot.accounts);

  const summary: LegacyImportSummary = {
    accountSource: snapshot.accountSource,
    accountsImported: 0,
    accountsMatchedExisting: 0,
    accountsWithoutPassword: 0,
    skippedDeletedAccounts: snapshot.stats.skippedDeletedAccounts,
    undecryptableValues: snapshot.stats.undecryptableValues,
    keyValuesImported: 0,
    skippedKeyValueKeys: snapshot.stats.skippedKeyValueKeys,
    playbackProgressImported: 0,
    dailyActivitiesImported: 0,
    blockedContentsImported: 0,
    blockedUsersImported: 0,
    orphanRowsSkipped: 0,
  };

  await db.run(sql.raw('BEGIN IMMEDIATE'));

  try {
    const accountIdMap = await importAccounts(db, prepared, now, summary);

    for (const entry of snapshot.keyValues) {
      let value = entry.value;

      if (entry.key === LEGACY_ACTIVE_PROFILE_KEY) {
        const mapped = accountIdMap.get(Number.parseInt(value, 10));

        if (mapped === undefined) {
          continue;
        }

        value = String(mapped);
      }

      const inserted = await db
        .insert(keyValueStore)
        .values({
          key: entry.key,
          value,
          createdAt: entry.createdAt ?? now,
          updatedAt: entry.updatedAt ?? now,
        })
        .onConflictDoNothing()
        .returning({ key: keyValueStore.key });
      summary.keyValuesImported += inserted.length;
    }

    for (const row of snapshot.playbackProgress) {
      const accountId =
        row.accountId === null ? null : accountIdMap.get(row.accountId);

      if (accountId === undefined) {
        summary.orphanRowsSkipped++;
        continue;
      }

      const inserted = await db
        .insert(playbackProgress)
        .values({
          accountId,
          cid: row.cid,
          activityId: row.activityId,
          durationSeconds: row.durationSeconds,
          positionSeconds: row.positionSeconds,
          mediaDurationSeconds: row.mediaDurationSeconds,
          hunguUploadSuccess: row.hunguUploadSuccess,
          createdAt: row.createdAt ?? now,
          updatedAt: row.updatedAt ?? now,
        })
        .onConflictDoNothing()
        .returning({ id: playbackProgress.id });
      summary.playbackProgressImported += inserted.length;
    }

    for (const row of snapshot.dailyActivities) {
      const accountId = accountIdMap.get(row.accountId);

      if (accountId === undefined) {
        summary.orphanRowsSkipped++;
        continue;
      }

      const inserted = await db
        .insert(accountDailyActivities)
        .values({
          accountId,
          activityDate: row.activityDate,
          totalSeconds: row.totalSeconds,
          createdAt: row.createdAt ?? now,
          updatedAt: row.updatedAt ?? now,
        })
        .onConflictDoNothing()
        .returning({ id: accountDailyActivities.id });
      summary.dailyActivitiesImported += inserted.length;
    }

    for (const row of snapshot.blockedContents) {
      const inserted = await db
        .insert(blockedContents)
        .values({
          boardHash: row.boardHash,
          nodeHash: row.nodeHash,
          reason: row.reason,
          blockedAt: row.blockedAt ?? row.createdAt ?? now,
          createdAt: row.createdAt ?? now,
          updatedAt: row.updatedAt ?? now,
        })
        .onConflictDoNothing()
        .returning({ id: blockedContents.id });
      summary.blockedContentsImported += inserted.length;
    }

    for (const row of snapshot.blockedUsers) {
      const inserted = await db
        .insert(blockedUsers)
        .values({
          poster: row.poster,
          realname: row.realname,
          createdAt: row.createdAt ?? now,
          updatedAt: row.updatedAt ?? now,
        })
        .onConflictDoNothing()
        .returning({ id: blockedUsers.id });
      summary.blockedUsersImported += inserted.length;
    }

    if (options.completionMarker !== undefined) {
      const { key, value } = options.completionMarker;

      await db
        .insert(keyValueStore)
        .values({ key, value, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: keyValueStore.key,
          set: { value, updatedAt: now },
        });
    }

    await db.run(sql.raw('COMMIT'));
  } catch (error) {
    await db.run(sql.raw('ROLLBACK'));
    throw error;
  }

  return summary;
}

async function prepareAccounts(
  cipher: CredentialCipher,
  legacyAccounts: LegacyAccount[],
): Promise<PreparedAccount[]> {
  const prepared: PreparedAccount[] = [];

  for (const legacy of legacyAccounts) {
    prepared.push({
      legacy,
      password:
        legacy.password === null
          ? null
          : await cipher.encrypt(legacy.password, PASSWORD_PURPOSE),
      hunguSession:
        legacy.hunguSession === null
          ? null
          : await cipher.encryptJson(
              mapSession(legacy.hunguSession),
              HUNGU_SESSION_PURPOSE,
            ),
      schoolPortalSession:
        legacy.schoolPortalSession === null
          ? null
          : await cipher.encryptJson(
              mapSession(legacy.schoolPortalSession),
              SCHOOL_PORTAL_SESSION_PURPOSE,
            ),
    });
  }

  return prepared;
}

/** PHP encodes an empty cookie array as `[]`; the new store wants `{}`. */
function mapSession(legacy: Record<string, unknown>) {
  const cookies = legacy.cookies;

  return fromLegacySession({
    ...legacy,
    cookies: Array.isArray(cookies) ? {} : cookies,
  });
}

/** Returns legacy account id → new account id. */
async function importAccounts(
  db: AltUUDatabase,
  prepared: PreparedAccount[],
  now: Date,
  summary: LegacyImportSummary,
): Promise<Map<number, number>> {
  const existing = await db
    .select({ id: accounts.id, username: accounts.username })
    .from(accounts);
  const idByUsername = new Map(existing.map((row) => [row.username, row.id]));
  const takenIds = new Set(existing.map((row) => row.id));
  const accountIdMap = new Map<number, number>();
  // Accounts whose legacy id is free go first, so an auto-assigned id can
  // never take an id another legacy account could have kept.
  const ordered = [
    ...prepared.filter((account) => !takenIds.has(account.legacy.id)),
    ...prepared.filter((account) => takenIds.has(account.legacy.id)),
  ];

  for (const account of ordered) {
    const { legacy } = account;
    const username = legacy.username.trim();
    const existingId = idByUsername.get(username);

    if (existingId !== undefined) {
      accountIdMap.set(legacy.id, existingId);
      summary.accountsMatchedExisting++;
      continue;
    }

    const values = {
      username,
      nickname: legacy.nickname,
      password: account.password,
      hunguSession: account.hunguSession,
      schoolPortalSession: account.schoolPortalSession,
      createdAt: legacy.createdAt ?? now,
      updatedAt: legacy.updatedAt ?? now,
    };
    const inserted = await db
      .insert(accounts)
      .values(takenIds.has(legacy.id) ? values : { id: legacy.id, ...values })
      .returning({ id: accounts.id });
    const newId = inserted[0].id;

    takenIds.add(newId);
    idByUsername.set(username, newId);
    accountIdMap.set(legacy.id, newId);
    summary.accountsImported++;

    if (account.password === null) {
      summary.accountsWithoutPassword++;
    }
  }

  return accountIdMap;
}
