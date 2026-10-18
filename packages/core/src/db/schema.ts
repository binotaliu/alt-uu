import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/** `created_at` / `updated_at` pair, stored as epoch milliseconds. */
const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
};

/**
 * `password`, `hungu_session` and `school_portal_session` hold ciphertext
 * produced by the credential cipher (never plaintext).
 */
export const accounts = sqliteTable(
  'accounts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull(),
    nickname: text('nickname', { length: 30 }),
    password: text('password'),
    hunguSession: text('hungu_session'),
    schoolPortalSession: text('school_portal_session'),
    ...timestamps,
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (table) => [uniqueIndex('accounts_username_unique').on(table.username)],
);

export const keyValueStore = sqliteTable('key_value_store', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  ...timestamps,
});

export const cache = sqliteTable(
  'cache',
  {
    key: text('key').primaryKey(),
    /** JSON-encoded value. */
    value: text('value').notNull(),
    /** Epoch milliseconds; null means the entry never expires. */
    expiresAt: integer('expires_at'),
  },
  (table) => [index('cache_expires_at_index').on(table.expiresAt)],
);

export const playbackProgress = sqliteTable(
  'playback_progress',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    accountId: integer('account_id').references(() => accounts.id, {
      onDelete: 'cascade',
    }),
    cid: text('cid', { length: 64 }).notNull(),
    activityId: text('activity_id', { length: 191 }).notNull(),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    positionSeconds: real('position_seconds').notNull().default(0),
    mediaDurationSeconds: real('media_duration_seconds'),
    hunguUploadSuccess: integer('hungu_upload_success', {
      mode: 'boolean',
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('playback_progress_account_id_cid_activity_id_unique').on(
      table.accountId,
      table.cid,
      table.activityId,
    ),
  ],
);

export const accountDailyActivities = sqliteTable(
  'account_daily_activities',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    accountId: integer('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    /** `YYYY-MM-DD` (Asia/Taipei day, as in legacy). */
    activityDate: text('activity_date').notNull(),
    totalSeconds: integer('total_seconds').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('account_daily_activities_account_id_activity_date_unique').on(
      table.accountId,
      table.activityDate,
    ),
  ],
);

export const attachmentDownloads = sqliteTable(
  'attachment_downloads',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    cid: text('cid', { length: 64 }).notNull(),
    source: text('source', { length: 32 }).notNull().default('hungu'),
    sourceUrl: text('source_url').notNull(),
    fileName: text('file_name', { length: 255 }),
    status: text('status', { length: 32 }).notNull(),
    relativePath: text('relative_path', { length: 512 }),
    mimeType: text('mime_type', { length: 255 }),
    fileSize: integer('file_size'),
    errorMessage: text('error_message'),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    ...timestamps,
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('attachment_downloads_status_index').on(table.status),
    index('attachment_downloads_cid_status_index').on(table.cid, table.status),
  ],
);

export const blockedContents = sqliteTable(
  'blocked_contents',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    boardHash: text('board_hash', { length: 64 }).notNull(),
    nodeHash: text('node_hash', { length: 64 }).notNull(),
    reason: text('reason', { length: 1 }).notNull(),
    blockedAt: integer('blocked_at', { mode: 'timestamp_ms' }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('blocked_contents_board_hash_node_hash_unique').on(
      table.boardHash,
      table.nodeHash,
    ),
  ],
);

export const blockedUsers = sqliteTable(
  'blocked_users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    poster: text('poster').notNull(),
    realname: text('realname').notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('blocked_users_poster_realname_unique').on(
      table.poster,
      table.realname,
    ),
  ],
);

export const diagnosticEvents = sqliteTable(
  'diagnostic_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** Epoch milliseconds: ordering matters when diagnosing races. */
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    type: text('type').notNull(),
    level: text('level').notNull().default('info'),
    source: text('source').notNull().default('server'),
    op: text('op'),
    requestId: text('request_id'),
    summary: text('summary').notNull(),
    status: integer('status'),
    durationMs: integer('duration_ms'),
    context: text('context', { mode: 'json' }).$type<Record<
      string,
      unknown
    > | null>(),
  },
  (table) => [
    index('diagnostic_events_occurred_at_index').on(table.occurredAt),
    index('diagnostic_events_request_id_index').on(table.requestId),
    index('diagnostic_events_level_occurred_at_index').on(
      table.level,
      table.occurredAt,
    ),
  ],
);

export const schema = {
  accounts,
  keyValueStore,
  cache,
  playbackProgress,
  accountDailyActivities,
  attachmentDownloads,
  blockedContents,
  blockedUsers,
  diagnosticEvents,
};

export type Schema = typeof schema;
