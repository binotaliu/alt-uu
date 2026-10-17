import type { Logger, SqlValue } from '../platform';
import { parseLaravelDateTime, toTaipeiDateString } from './datetime';
import type { LaravelEncrypter } from './laravelEncrypter';
import type {
    LegacyAccount,
    LegacyBlockedContent,
    LegacyBlockedUser,
    LegacyDailyActivity,
    LegacyDatabaseReader,
    LegacyKeyValue,
    LegacyPlaybackProgress,
    LegacyRow,
    LegacySnapshot,
} from './types';

/** `config/account.php` `active_profile_key`. */
export const LEGACY_ACTIVE_PROFILE_KEY = 'account.active_profile';

/**
 * Legacy key_value_store keys that are still meaningful and are copied
 * verbatim (none of them is encrypted). Everything else is dropped:
 * - `hungu_remembered_credentials` / `hungu_session` / `school_portal_session`:
 *   pre-accounts (v1.0.x) secrets, turned into an account instead
 *   (port of migration 2026_07_11_091600), never copied as-is;
 * - `preference:diagnostics-recording-until`: a transient recording window
 *   tied to the (not migrated) diagnostic_events table;
 * - unknown keys.
 */
export const LEGACY_KEY_VALUE_ALLOWLIST: readonly string[] = [
    LEGACY_ACTIVE_PROFILE_KEY,
    'preference:appearance',
    'preference:accent-color',
    'preference:nou-tools-integration',
    'preference:screen-reader-enhanced-support',
    'preference:alt-uu-plus-disabled',
    'preference:onboarding-completed',
    'preference:live-sessions-timezone',
    'preference:live-session-nickname-modal-enabled',
    'preference:cellular-playback-warning-enabled',
    'preference:whats-new-seen-version',
    'preference:material-html-scale',
    'app-status:dismissed',
    'moderation:blocked_contents_synced_at',
    'moderation:client_fingerprint',
    'subscription:entitlement',
    'diagnostics.salt',
];

const LEGACY_CREDENTIALS_KEY = 'hungu_remembered_credentials';
const LEGACY_HUNGU_SESSION_KEY = 'hungu_session';
const LEGACY_SCHOOL_PORTAL_SESSION_KEY = 'school_portal_session';

/** Account id Laravel assigns to the first row of the fresh accounts table. */
const SYNTHESIZED_ACCOUNT_ID = 1;

interface ReaderContext {
    reader: LegacyDatabaseReader;
    encrypter: LaravelEncrypter | null;
    logger?: Logger;
    tables: Set<string>;
    undecryptable: number;
}

/**
 * Reads the legacy database into a decrypted {@link LegacySnapshot}.
 * Returns null when the file holds no legacy app data (missing or empty
 * file, or a DB that never ran the app migrations).
 *
 * Users can upgrade from any shipped release, so older schemas are handled
 * by porting the relevant legacy data migrations: accounts from KV
 * credentials (2026_07_11_091600), playback ownership (113520), daily
 * activity backfill (150703) and playback de-duplication (184036).
 */
export async function readLegacySnapshot(
    reader: LegacyDatabaseReader,
    encrypter: LaravelEncrypter | null,
    logger?: Logger,
): Promise<LegacySnapshot | null> {
    const tableRows = await reader.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const tables = new Set(tableRows.map((row) => row.name));

    if (!tables.has('key_value_store') && !tables.has('accounts')) {
        return null;
    }

    const context: ReaderContext = {
        reader,
        encrypter,
        logger,
        tables,
        undecryptable: 0,
    };

    const rawKeyValues = await selectAll(context, 'key_value_store');
    const keyValueByKey = new Map(
        rawKeyValues.map((row) => [String(row.key), row]),
    );

    let accountSource: LegacySnapshot['accountSource'] = 'none';
    let accounts: LegacyAccount[] = [];
    let skippedDeletedAccounts = 0;

    if (tables.has('accounts')) {
        accountSource = 'accounts-table';
        const rows = await selectAll(context, 'accounts');

        for (const row of rows) {
            if (row.deleted_at !== undefined && row.deleted_at !== null) {
                skippedDeletedAccounts++;
                continue;
            }

            accounts.push({
                id: Number(row.id),
                username: String(row.username),
                nickname: optionalString(row.nickname),
                password: decryptString(context, row.password, 'password'),
                hunguSession: decryptSession(
                    context,
                    row.hungu_session,
                    'hungu_session',
                ),
                schoolPortalSession: decryptSession(
                    context,
                    row.school_portal_session,
                    'school_portal_session',
                ),
                createdAt: parseLaravelDateTime(row.created_at),
                updatedAt: parseLaravelDateTime(row.updated_at),
            });
        }
    } else {
        const synthesized = synthesizeAccountFromKeyValues(
            context,
            keyValueByKey,
        );

        if (synthesized !== null) {
            accountSource = 'key-value-credentials';
            accounts = [synthesized];
        }
    }

    const { keyValues, skippedKeyValueKeys } = collectKeyValues(
        rawKeyValues,
        accountSource,
        accounts,
    );

    const allPlayback = await readPlaybackProgress(context, accounts);
    const dailyActivities = tables.has('account_daily_activities')
        ? (await selectAll(context, 'account_daily_activities')).map(
              toDailyActivity,
          )
        : backfillDailyActivities(allPlayback);

    return {
        accountSource,
        accounts,
        keyValues,
        playbackProgress: dedupePlayback(allPlayback),
        dailyActivities,
        blockedContents: (await selectAll(context, 'blocked_contents')).map(
            toBlockedContent,
        ),
        blockedUsers: (await selectAll(context, 'blocked_users')).map(
            toBlockedUser,
        ),
        stats: {
            skippedDeletedAccounts,
            undecryptableValues: context.undecryptable,
            skippedKeyValueKeys,
        },
    };
}

async function selectAll(
    context: ReaderContext,
    table: string,
): Promise<LegacyRow[]> {
    if (!context.tables.has(table)) {
        return [];
    }

    return context.reader.query<LegacyRow>(
        `SELECT * FROM "${table}" ORDER BY rowid`,
    );
}

function synthesizeAccountFromKeyValues(
    context: ReaderContext,
    keyValueByKey: Map<string, LegacyRow>,
): LegacyAccount | null {
    const credentialsRow = keyValueByKey.get(LEGACY_CREDENTIALS_KEY);

    if (credentialsRow === undefined) {
        return null;
    }

    const credentials = decryptJson(
        context,
        credentialsRow.value,
        LEGACY_CREDENTIALS_KEY,
    );

    if (credentials === null || Array.isArray(credentials)) {
        return null;
    }

    const username = String(credentials.username ?? '').trim();
    const password = String(credentials.password ?? '');

    if (username === '' || password === '') {
        return null;
    }

    const at = parseLaravelDateTime(credentialsRow.updated_at);

    return {
        id: SYNTHESIZED_ACCOUNT_ID,
        username,
        nickname: null,
        password,
        hunguSession: decryptSession(
            context,
            keyValueByKey.get(LEGACY_HUNGU_SESSION_KEY)?.value,
            LEGACY_HUNGU_SESSION_KEY,
        ),
        schoolPortalSession: decryptSession(
            context,
            keyValueByKey.get(LEGACY_SCHOOL_PORTAL_SESSION_KEY)?.value,
            LEGACY_SCHOOL_PORTAL_SESSION_KEY,
        ),
        createdAt: at,
        updatedAt: at,
    };
}

function collectKeyValues(
    rows: LegacyRow[],
    accountSource: LegacySnapshot['accountSource'],
    accounts: LegacyAccount[],
): { keyValues: LegacyKeyValue[]; skippedKeyValueKeys: string[] } {
    const allowed = new Set(LEGACY_KEY_VALUE_ALLOWLIST);
    const keyValues: LegacyKeyValue[] = [];
    const skippedKeyValueKeys: string[] = [];

    for (const row of rows) {
        const key = String(row.key);

        if (!allowed.has(key) || typeof row.value !== 'string') {
            skippedKeyValueKeys.push(key);
            continue;
        }

        keyValues.push({
            key,
            value: row.value,
            createdAt: parseLaravelDateTime(row.created_at),
            updatedAt: parseLaravelDateTime(row.updated_at),
        });
    }

    // Migration 091600 made the synthesized account the active profile.
    if (
        accountSource === 'key-value-credentials' &&
        accounts.length === 1 &&
        !keyValues.some((entry) => entry.key === LEGACY_ACTIVE_PROFILE_KEY)
    ) {
        keyValues.push({
            key: LEGACY_ACTIVE_PROFILE_KEY,
            value: String(accounts[0].id),
            createdAt: null,
            updatedAt: null,
        });
    }

    return { keyValues, skippedKeyValueKeys };
}

async function readPlaybackProgress(
    context: ReaderContext,
    accounts: LegacyAccount[],
): Promise<LegacyPlaybackProgress[]> {
    const rows = await selectAll(context, 'playback_progress');
    const hasAccountColumn = rows.length > 0 && 'account_id' in rows[0];
    // Migration 113520: rows predating accounts belong to the only account.
    const implicitAccountId = accounts.length === 1 ? accounts[0].id : null;

    return rows.map((row) => ({
        accountId: hasAccountColumn
            ? optionalNumber(row.account_id)
            : implicitAccountId,
        cid: String(row.cid),
        activityId: String(row.activity_id),
        durationSeconds: Math.trunc(Number(row.duration_seconds ?? 0)),
        positionSeconds: Number(row.position_seconds ?? 0),
        mediaDurationSeconds: optionalNumber(row.media_duration_seconds),
        hunguUploadSuccess:
            row.hungu_upload_success === null ||
            row.hungu_upload_success === undefined
                ? null
                : Boolean(Number(row.hungu_upload_success)),
        createdAt: parseLaravelDateTime(row.created_at),
        updatedAt: parseLaravelDateTime(row.updated_at),
    }));
}

/** Migration 184036: keep the newest row per (account, cid, activity). */
function dedupePlayback(
    rows: LegacyPlaybackProgress[],
): LegacyPlaybackProgress[] {
    const newestFirst = rows
        .map((row, index) => ({ row, index }))
        .sort(
            (left, right) =>
                (right.row.updatedAt?.getTime() ?? 0) -
                    (left.row.updatedAt?.getTime() ?? 0) ||
                right.index - left.index,
        );
    const seen = new Set<string>();
    const kept: LegacyPlaybackProgress[] = [];

    for (const { row } of newestFirst) {
        const key = `${row.accountId ?? 'null'}\u0000${row.cid}\u0000${row.activityId}`;

        if (!seen.has(key)) {
            seen.add(key);
            kept.push(row);
        }
    }

    return kept.reverse();
}

/** Migration 150703: daily totals by Asia/Taipei day of `updated_at`. */
function backfillDailyActivities(
    rows: LegacyPlaybackProgress[],
): LegacyDailyActivity[] {
    const totals = new Map<string, LegacyDailyActivity>();

    for (const row of rows) {
        if (row.accountId === null || row.updatedAt === null) {
            continue;
        }

        const activityDate = toTaipeiDateString(row.updatedAt);
        const key = `${row.accountId}|${activityDate}`;
        const existing = totals.get(key);

        if (existing === undefined) {
            totals.set(key, {
                accountId: row.accountId,
                activityDate,
                totalSeconds: row.durationSeconds,
                createdAt: null,
                updatedAt: null,
            });
        } else {
            existing.totalSeconds += row.durationSeconds;
        }
    }

    return [...totals.values()];
}

function toDailyActivity(row: LegacyRow): LegacyDailyActivity {
    return {
        accountId: Number(row.account_id),
        activityDate: String(row.activity_date).slice(0, 10),
        totalSeconds: Math.trunc(Number(row.total_seconds ?? 0)),
        createdAt: parseLaravelDateTime(row.created_at),
        updatedAt: parseLaravelDateTime(row.updated_at),
    };
}

function toBlockedContent(row: LegacyRow): LegacyBlockedContent {
    return {
        boardHash: String(row.board_hash),
        nodeHash: String(row.node_hash),
        reason: String(row.reason),
        blockedAt: parseLaravelDateTime(row.blocked_at),
        createdAt: parseLaravelDateTime(row.created_at),
        updatedAt: parseLaravelDateTime(row.updated_at),
    };
}

function toBlockedUser(row: LegacyRow): LegacyBlockedUser {
    return {
        poster: String(row.poster),
        realname: String(row.realname),
        createdAt: parseLaravelDateTime(row.created_at),
        updatedAt: parseLaravelDateTime(row.updated_at),
    };
}

function decryptString(
    context: ReaderContext,
    payload: SqlValue | undefined,
    label: string,
): string | null {
    if (typeof payload !== 'string' || payload === '') {
        return null;
    }

    if (context.encrypter === null) {
        context.undecryptable++;

        return null;
    }

    try {
        return context.encrypter.decryptString(payload);
    } catch (error) {
        context.undecryptable++;
        context.logger?.log('warn', 'legacy-migration: undecryptable value', {
            column: label,
            error: error instanceof Error ? error.message : String(error),
        });

        return null;
    }
}

function decryptJson(
    context: ReaderContext,
    payload: SqlValue | undefined,
    label: string,
): Record<string, unknown> | unknown[] | null {
    const plaintext = decryptString(context, payload, label);

    if (plaintext === null) {
        return null;
    }

    try {
        const decoded = JSON.parse(plaintext) as unknown;

        return decoded !== null && typeof decoded === 'object'
            ? (decoded as Record<string, unknown> | unknown[])
            : null;
    } catch {
        context.undecryptable++;

        return null;
    }
}

/** `encrypted:array` session column; PHP `[]` (empty array) → null. */
function decryptSession(
    context: ReaderContext,
    payload: SqlValue | undefined,
    label: string,
): Record<string, unknown> | null {
    const decoded = decryptJson(context, payload, label);

    return decoded === null || Array.isArray(decoded) ? null : decoded;
}

function optionalString(value: SqlValue | undefined): string | null {
    return typeof value === 'string' && value !== '' ? value : null;
}

function optionalNumber(value: SqlValue | undefined): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
}
