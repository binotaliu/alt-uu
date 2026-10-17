import type { SqlDatabase, SqlValue } from '../platform';

export type LegacyRow = Record<string, SqlValue>;

/**
 * Read-only view of the legacy NativePHP (Laravel) SQLite database. Mobile
 * adapts expo-sqlite, tests adapt better-sqlite3.
 */
export type LegacyDatabaseReader = Pick<SqlDatabase, 'query'>;

export interface LegacyDatabaseHandle {
    reader: LegacyDatabaseReader;
    close(): Promise<void>;
}

export interface LegacyAccount {
    id: number;
    username: string;
    nickname: string | null;
    /** Decrypted plaintext; null when absent or undecryptable. */
    password: string | null;
    /** Decrypted legacy (snake_case) session arrays. */
    hunguSession: Record<string, unknown> | null;
    schoolPortalSession: Record<string, unknown> | null;
    createdAt: Date | null;
    updatedAt: Date | null;
}

export interface LegacyKeyValue {
    key: string;
    value: string;
    createdAt: Date | null;
    updatedAt: Date | null;
}

export interface LegacyPlaybackProgress {
    accountId: number | null;
    cid: string;
    activityId: string;
    durationSeconds: number;
    positionSeconds: number;
    mediaDurationSeconds: number | null;
    hunguUploadSuccess: boolean | null;
    createdAt: Date | null;
    updatedAt: Date | null;
}

export interface LegacyDailyActivity {
    accountId: number;
    activityDate: string;
    totalSeconds: number;
    createdAt: Date | null;
    updatedAt: Date | null;
}

export interface LegacyBlockedContent {
    boardHash: string;
    nodeHash: string;
    reason: string;
    blockedAt: Date | null;
    createdAt: Date | null;
    updatedAt: Date | null;
}

export interface LegacyBlockedUser {
    poster: string;
    realname: string;
    createdAt: Date | null;
    updatedAt: Date | null;
}

/** Everything worth keeping from the legacy DB, already decrypted. */
export interface LegacySnapshot {
    /** `accounts` table (current schema) or the pre-accounts KV credentials (v1.0.x). */
    accountSource: 'accounts-table' | 'key-value-credentials' | 'none';
    accounts: LegacyAccount[];
    keyValues: LegacyKeyValue[];
    playbackProgress: LegacyPlaybackProgress[];
    dailyActivities: LegacyDailyActivity[];
    blockedContents: LegacyBlockedContent[];
    blockedUsers: LegacyBlockedUser[];
    stats: {
        skippedDeletedAccounts: number;
        undecryptableValues: number;
        skippedKeyValueKeys: string[];
    };
}

export interface LegacyImportSummary {
    accountSource: LegacySnapshot['accountSource'];
    accountsImported: number;
    accountsMatchedExisting: number;
    accountsWithoutPassword: number;
    skippedDeletedAccounts: number;
    undecryptableValues: number;
    keyValuesImported: number;
    skippedKeyValueKeys: string[];
    playbackProgressImported: number;
    dailyActivitiesImported: number;
    blockedContentsImported: number;
    blockedUsersImported: number;
    /** Rows that belonged to accounts that were not imported (deleted). */
    orphanRowsSkipped: number;
}
