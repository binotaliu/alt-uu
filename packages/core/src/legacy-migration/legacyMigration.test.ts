import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { asc } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from '../../test/db/helpers';
import {
    accountDailyActivities,
    accounts,
    blockedContents,
    blockedUsers,
    playbackProgress,
} from '../db/schema';
import {
    FIXTURE_APP_KEY,
    FIXTURE_PREVIOUS_APP_KEY,
    legacyFixturePath,
    openReadOnlyLegacyDatabase,
    readFixtureBytes,
    type LegacyFixtureName,
} from './__fixtures__';
import { resolveNativePhpLegacyLocation } from './nativePhpLocations';
import {
    LEGACY_MIGRATION_STATUS_KEY,
    runLegacyMigration,
    type RunLegacyMigrationDeps,
} from './runner';

function migrationDeps(
    ctx: TestContext,
    fixture: LegacyFixtureName | null,
    appKeys: readonly string[] = [FIXTURE_APP_KEY, FIXTURE_PREVIOUS_APP_KEY],
): RunLegacyMigrationDeps {
    return {
        db: ctx.db,
        cipher: ctx.cipher,
        keyValues: ctx.keyValues,
        clock: ctx.clock,
        openLegacyDatabase: async () =>
            fixture === null
                ? null
                : openReadOnlyLegacyDatabase(legacyFixturePath(fixture)),
        readAppKeys: async () => appKeys,
    };
}

const at = (iso: string) => new Date(iso);

describe('legacy migration: current schema (v1.1.x)', () => {
    it('imports accounts, secrets, preferences and history once', async () => {
        const ctx = await createTestContext();
        const before = createHash('sha256')
            .update(readFixtureBytes('legacy-current'))
            .digest('hex');

        const outcome = await runLegacyMigration(
            migrationDeps(ctx, 'legacy-current'),
        );

        expect(outcome.status).toBe('completed');

        if (outcome.status !== 'completed') {
            return;
        }

        expect(outcome.summary).toMatchObject({
            accountSource: 'accounts-table',
            accountsImported: 2,
            accountsWithoutPassword: 0,
            skippedDeletedAccounts: 1,
            undecryptableValues: 0,
            keyValuesImported: 17,
            playbackProgressImported: 3,
            dailyActivitiesImported: 2,
            blockedContentsImported: 1,
            blockedUsersImported: 1,
            orphanRowsSkipped: 2,
        });
        expect(outcome.summary.skippedKeyValueKeys.sort()).toEqual([
            'hungu_remembered_credentials',
            'preference:diagnostics-recording-until',
            'unknown:future-key',
        ]);

        // Ids preserved, deleted account 2 skipped.
        const accountRows = await ctx.db
            .select()
            .from(accounts)
            .orderBy(asc(accounts.id));
        expect(
            accountRows.map(
                ({ id, username, nickname, createdAt, updatedAt }) => ({
                    id,
                    username,
                    nickname,
                    createdAt,
                    updatedAt,
                }),
            ),
        ).toEqual([
            {
                id: 1,
                username: 's1111111',
                nickname: '小明',
                createdAt: at('2026-07-12T01:02:03Z'),
                updatedAt: at('2026-08-15T04:05:06Z'),
            },
            {
                id: 3,
                username: 's3333333',
                nickname: null,
                createdAt: at('2026-07-12T01:02:03Z'),
                updatedAt: at('2026-08-15T04:05:06Z'),
            },
        ]);

        // Secrets readable through the new encrypted stores.
        expect(await ctx.credentials.get(1)).toEqual({
            username: 's1111111',
            password: 'pässword-1',
        });
        expect(await ctx.credentials.get(3)).toEqual({
            username: 's3333333',
            password: 'rotated-pass-3',
        });
        expect(await ctx.hunguSessions.get(1)).toEqual({
            baseUrl: 'https://uu.nou.edu.tw',
            userAgent: 'AltUU/1.1.0',
            cookies: { WM: 'wm-cookie', idx: '42' },
            ticket: 'ticket-1',
            session_idx: 7,
            profile: { username: 's1111111', realname: '王小明' },
        });
        expect(await ctx.portalSessions.get(1)).toEqual({
            baseUrl: 'https://nouapp.nou.edu.tw',
            userAgent: 'AltUU/1.1.0',
            cookies: {},
        });
        expect(await ctx.hunguSessions.get(3)).toBeNull();
        expect(await ctx.activeProfile.get()).toBe(1);

        expect(await ctx.keyValues.get('preference:appearance')).toBe('dark');
        expect(await ctx.keyValues.get('preference:material-html-scale')).toBe(
            '1.2',
        );
        expect(await ctx.keyValues.get('app-status:dismissed')).toBe(
            '["status-1","status-2"]',
        );
        expect(await ctx.keyValues.get('diagnostics.salt')).toBe(
            'salt-0123456789',
        );
        expect(
            await ctx.keyValues.get('preference:diagnostics-recording-until'),
        ).toBeNull();
        expect(
            await ctx.keyValues.get('hungu_remembered_credentials'),
        ).toBeNull();

        const playback = await ctx.db
            .select()
            .from(playbackProgress)
            .orderBy(
                asc(playbackProgress.cid),
                asc(playbackProgress.activityId),
            );
        expect(
            playback.map((row) => {
                const { id, ...rest } = row;
                expect(id).toBeTypeOf('number');

                return rest;
            }),
        ).toEqual([
            {
                accountId: 1,
                cid: '10001',
                activityId: 'act-1',
                durationSeconds: 120,
                positionSeconds: 61.5,
                mediaDurationSeconds: 900.25,
                hunguUploadSuccess: true,
                createdAt: at('2026-08-01T15:00:00Z'),
                updatedAt: at('2026-08-01T16:30:00Z'),
            },
            {
                accountId: 1,
                cid: '10001',
                activityId: 'act-2',
                durationSeconds: 30,
                positionSeconds: 0,
                mediaDurationSeconds: null,
                hunguUploadSuccess: null,
                createdAt: at('2026-08-02T01:00:00Z'),
                updatedAt: at('2026-08-02T01:00:00Z'),
            },
            {
                accountId: null,
                cid: '30003',
                activityId: 'act-0',
                durationSeconds: 5,
                positionSeconds: 2,
                mediaDurationSeconds: null,
                hunguUploadSuccess: false,
                createdAt: at('2026-06-01T01:00:00Z'),
                updatedAt: at('2026-06-01T01:00:00Z'),
            },
        ]);

        const daily = await ctx.db
            .select()
            .from(accountDailyActivities)
            .orderBy(asc(accountDailyActivities.activityDate));
        expect(
            daily.map(({ accountId, activityDate, totalSeconds }) => ({
                accountId,
                activityDate,
                totalSeconds,
            })),
        ).toEqual([
            { accountId: 1, activityDate: '2026-08-01', totalSeconds: 120 },
            { accountId: 1, activityDate: '2026-08-02', totalSeconds: 30 },
        ]);

        const [blocked] = await ctx.db.select().from(blockedContents);
        expect(blocked).toMatchObject({
            boardHash: 'a'.repeat(64),
            nodeHash: 'b'.repeat(64),
            reason: 'S',
            blockedAt: at('2026-08-10T00:00:00Z'),
        });
        expect(await ctx.db.select().from(blockedUsers)).toMatchObject([
            { poster: 'u123', realname: '某人' },
        ]);

        // Recorded once; later launches are no-ops.
        expect(
            JSON.parse((await ctx.keyValues.get(LEGACY_MIGRATION_STATUS_KEY))!),
        ).toMatchObject({ status: 'completed', attempts: 1 });
        expect(
            (await runLegacyMigration(migrationDeps(ctx, 'legacy-current')))
                .status,
        ).toBe('already-done');

        // The legacy file is never modified.
        expect(
            createHash('sha256')
                .update(readFixtureBytes('legacy-current'))
                .digest('hex'),
        ).toBe(before);
    });

    it('imports accounts without the secrets it cannot decrypt', async () => {
        const ctx = await createTestContext();

        const outcome = await runLegacyMigration(
            migrationDeps(ctx, 'legacy-current', [FIXTURE_APP_KEY]),
        );

        expect(outcome).toMatchObject({
            status: 'completed',
            summary: { accountsImported: 2, undecryptableValues: 1 },
        });
        expect(await ctx.credentials.get(3)).toBeNull();
        expect(
            (await ctx.credentials.all()).map((account) => account.username),
        ).toEqual(['s1111111', 's3333333']);
    });

    it('still imports non-secret data when no APP_KEY is readable', async () => {
        const ctx = await createTestContext();
        const deps = migrationDeps(ctx, 'legacy-current', []);
        deps.readAppKeys = async () => {
            throw new Error('keychain unavailable');
        };

        const outcome = await runLegacyMigration(deps);

        expect(outcome).toMatchObject({
            status: 'completed',
            summary: {
                accountsImported: 2,
                accountsWithoutPassword: 2,
                playbackProgressImported: 3,
            },
        });
        expect(await ctx.hunguSessions.get(1)).toBeNull();
        expect(await ctx.activeProfile.get()).toBe(1);
    });

    it('keeps data already created in the new app and remaps ids', async () => {
        const ctx = await createTestContext();
        const newAccountId = await ctx.credentials.upsert({
            username: 'snew0001',
            password: 'new-pass',
        });
        expect(newAccountId).toBe(1);
        await ctx.keyValues.set('preference:appearance', 'light');

        const outcome = await runLegacyMigration(
            migrationDeps(ctx, 'legacy-current'),
        );
        expect(outcome.status).toBe('completed');

        const rows = await ctx.db
            .select({ id: accounts.id, username: accounts.username })
            .from(accounts)
            .orderBy(asc(accounts.id));
        expect(rows).toEqual([
            { id: 1, username: 'snew0001' },
            { id: 3, username: 's3333333' },
            { id: 4, username: 's1111111' },
        ]);
        expect(await ctx.credentials.get(4)).toEqual({
            username: 's1111111',
            password: 'pässword-1',
        });
        // Existing values win over legacy ones.
        expect(await ctx.activeProfile.get()).toBe(1);
        expect(await ctx.keyValues.get('preference:appearance')).toBe('light');

        const owners = await ctx.db
            .select({ accountId: playbackProgress.accountId })
            .from(playbackProgress);
        expect(owners.map((row) => row.accountId).sort()).toEqual([4, 4, null]);
    });
});

describe('legacy migration: pre-accounts schema (v1.0.x)', () => {
    it('ports the legacy data migrations while importing', async () => {
        const ctx = await createTestContext();

        const outcome = await runLegacyMigration(
            migrationDeps(ctx, 'legacy-v1.0.2'),
        );

        expect(outcome).toMatchObject({
            status: 'completed',
            summary: {
                accountSource: 'key-value-credentials',
                accountsImported: 1,
                playbackProgressImported: 2,
                dailyActivitiesImported: 2,
            },
        });
        expect(await ctx.credentials.get(1)).toEqual({
            username: 's0000001',
            password: 'old-pass',
        });
        expect(await ctx.hunguSessions.get(1)).toMatchObject({
            baseUrl: 'https://uu.nou.edu.tw',
            cookies: { WM: 'wm-cookie', idx: '42' },
            profile: { username: 's0000001' },
        });
        expect(await ctx.activeProfile.get()).toBe(1);
        expect(await ctx.keyValues.get('preference:appearance')).toBe('light');
        expect(await ctx.keyValues.get('hungu_session')).toBeNull();

        // De-duplicated: the newest act-1 row wins.
        const playback = await ctx.db
            .select()
            .from(playbackProgress)
            .orderBy(asc(playbackProgress.cid));
        expect(
            playback.map((row) => [
                row.accountId,
                row.cid,
                row.activityId,
                row.durationSeconds,
                row.positionSeconds,
            ]),
        ).toEqual([
            [1, '10001', 'act-1', 70, 40],
            [1, '10002', 'act-2', 20, 15],
        ]);

        // Backfilled from every row (before de-duplication), Taipei days.
        const daily = await ctx.db
            .select()
            .from(accountDailyActivities)
            .orderBy(asc(accountDailyActivities.activityDate));
        expect(
            daily.map((row) => [row.activityDate, row.totalSeconds]),
        ).toEqual([
            ['2026-05-01', 50],
            ['2026-05-02', 90],
        ]);
    });
});

describe('legacy migration: resilience', () => {
    it('records no-legacy-data when there is no database', async () => {
        const ctx = await createTestContext();

        expect(await runLegacyMigration(migrationDeps(ctx, null))).toEqual({
            status: 'no-legacy-data',
        });
        expect(
            (await runLegacyMigration(migrationDeps(ctx, null))).status,
        ).toBe('already-done');
    });

    it('treats an empty SQLite file as no legacy data', async () => {
        const ctx = await createTestContext();
        const path = join(mkdtempSync(join(tmpdir(), 'altuu-legacy-')), 'db');
        writeFileSync(path, '');
        const deps = migrationDeps(ctx, null);
        deps.openLegacyDatabase = async () => openReadOnlyLegacyDatabase(path);

        expect((await runLegacyMigration(deps)).status).toBe('no-legacy-data');
    });

    it('rolls back a failed import and retries up to maxAttempts', async () => {
        const ctx = await createTestContext();
        ctx.sqlite
            .exec(`CREATE TRIGGER fail_blocked_users BEFORE INSERT ON blocked_users
            BEGIN SELECT RAISE(ABORT, 'boom'); END;`);
        const deps = {
            ...migrationDeps(ctx, 'legacy-current'),
            maxAttempts: 2,
        };

        expect(await runLegacyMigration(deps)).toEqual({
            status: 'failed',
            error: expect.stringContaining('boom') as unknown as string,
            attempts: 1,
            willRetry: true,
        });
        // Nothing from the failed attempt is left behind.
        expect(await ctx.db.select().from(accounts)).toEqual([]);
        expect(await ctx.keyValues.get('preference:appearance')).toBeNull();

        ctx.sqlite.exec('DROP TRIGGER fail_blocked_users');
        expect((await runLegacyMigration(deps)).status).toBe('completed');
        expect(await ctx.credentials.get(1)).not.toBeNull();
    });

    it('gives up after maxAttempts without throwing', async () => {
        const ctx = await createTestContext();
        const deps = {
            ...migrationDeps(ctx, 'legacy-current'),
            maxAttempts: 2,
            openLegacyDatabase: async () => {
                throw new Error('cannot open');
            },
        };

        expect(await runLegacyMigration(deps)).toMatchObject({
            status: 'failed',
            willRetry: true,
        });
        expect(await runLegacyMigration(deps)).toMatchObject({
            status: 'failed',
            attempts: 2,
            willRetry: false,
        });
        expect((await runLegacyMigration(deps)).status).toBe('already-done');
    });
});

describe('resolveNativePhpLegacyLocation', () => {
    it('maps expo-sqlite directories to the NativePHP locations', () => {
        expect(
            resolveNativePhpLegacyLocation(
                'ios',
                '/var/mobile/Containers/Data/Application/UUID/Documents/SQLite',
            ),
        ).toEqual({
            databaseDirectory:
                '/var/mobile/Containers/Data/Application/UUID/Library/Application Support/database',
            databaseFileName: 'database.sqlite',
            appKeyFile: null,
        });
        expect(
            resolveNativePhpLegacyLocation(
                'android',
                '/data/user/0/org.binota.alt_uu/files/SQLite',
            ),
        ).toEqual({
            databaseDirectory:
                '/data/user/0/org.binota.alt_uu/app_storage/persisted_data/database',
            databaseFileName: 'database.sqlite',
            appKeyFile:
                '/data/user/0/org.binota.alt_uu/app_storage/persisted_data/appkey.txt',
        });
    });
});
