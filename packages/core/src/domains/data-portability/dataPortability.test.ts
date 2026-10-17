import { asc } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { loadFixtureJson, loadGolden } from '../../../test/fixtures';
import { accountDailyActivities, playbackProgress } from '../../db/schema';
import { createHarness, setClockTo } from '../account/testing';
import { PremiumRequiredError, ValidationError } from '../account/validation';
import {
    createDataPortabilityServices,
    mergeAccountData,
    type DataImportInput,
} from './index';

async function setup(options: { subscribed?: boolean } = {}) {
    const harness = await createHarness();
    const portability = createDataPortabilityServices({
        db: harness.db,
        clock: harness.clock,
        isSubscriptionActive: async () => options.subscribed ?? true,
    });

    return { harness, portability };
}

async function tableRows(harness: Awaited<ReturnType<typeof createHarness>>) {
    const progress = await harness.db
        .select()
        .from(playbackProgress)
        .orderBy(asc(playbackProgress.id));
    const activities = await harness.db
        .select()
        .from(accountDailyActivities)
        .orderBy(asc(accountDailyActivities.id));

    return {
        playbackProgressRows: progress.map((row) => ({
            cid: row.cid,
            activity_id: row.activityId,
            duration_seconds: row.durationSeconds,
            position_seconds: row.positionSeconds,
            hungu_upload_success: row.hunguUploadSuccess,
        })),
        accountDailyActivityRows: activities.map((row) => ({
            activity_date: row.activityDate,
            total_seconds: row.totalSeconds,
        })),
    };
}

// Ported from tests/Feature/DataPortability/DataExportImportTest.php
describe('export', () => {
    it('matches the legacy export (export-sample golden)', async () => {
        const { harness, portability } = await setup();
        const golden = loadGolden('data-portability', 'export-sample').cases[0];
        setClockTo(harness.clock, new Date('2026-07-10T12:00:00Z'));
        const id = await harness.credentials.upsert({
            username: 's2222222',
            password: 'p',
        });
        await harness.db.insert(playbackProgress).values({
            accountId: id,
            cid: '1001',
            activityId: 'N-1',
            durationSeconds: 120,
            positionSeconds: 42.5,
            hunguUploadSuccess: true,
        });
        await harness.db.insert(accountDailyActivities).values({
            accountId: id,
            activityDate: '2026-07-10',
            totalSeconds: 900,
        });

        const exported = await portability.exportData();

        expect(exported).toEqual((golden.output as { json: unknown }).json);

        const file = await portability.exportFile();
        expect(file.fileName).toBe('alt-uu-data-export-2026-07-10.json');
        expect(JSON.parse(file.contents)).toEqual(exported);
    });

    it('allows export without a subscription and writes empty accounts like PHP', async () => {
        const { portability } = await setup({ subscribed: false });

        const file = await portability.exportFile();

        expect(JSON.parse(file.contents).accounts).toEqual([]);
    });

    it('leaves soft-deleted accounts out of the export', async () => {
        const { harness, portability } = await setup();
        const id = await harness.credentials.upsert({
            username: 'gone',
            password: 'p',
        });
        await harness.credentials.forget(id);

        expect((await portability.exportData()).accounts).toEqual({});
    });
});

describe('import', () => {
    for (const scenario of [
        'import-matched-and-unknown',
        'import-idempotent',
    ] as const) {
        it(`matches the legacy import output (${scenario} golden)`, async () => {
            const { harness, portability } = await setup();
            const golden = loadGolden('data-portability', scenario).cases[0];
            const input = golden.input as {
                localAccount: string;
                times: number;
            };
            await harness.credentials.upsert({
                username: input.localAccount,
                password: 'p',
            });
            const payload = loadFixtureJson<DataImportInput>(
                'data-portability',
                scenario,
            );
            let result;

            for (let run = 0; run < input.times; run += 1) {
                result = await portability.importData(payload);
            }

            const output = golden.output as {
                json: unknown;
                playbackProgressRows: unknown;
                accountDailyActivityRows: unknown;
            };
            expect(result).toEqual(output.json);
            expect(await tableRows(harness)).toEqual({
                playbackProgressRows: output.playbackProgressRows,
                accountDailyActivityRows: output.accountDailyActivityRows,
            });
        });
    }

    it('rejects import without an active subscription and writes nothing (golden)', async () => {
        const { harness, portability } = await setup({ subscribed: false });
        const golden = loadGolden(
            'data-portability',
            'import-requires-subscription',
        ).cases[0];
        await harness.credentials.upsert({
            username: 's3333333',
            password: 'p',
        });

        await expect(
            portability.importData(
                loadFixtureJson(
                    'data-portability',
                    'import-requires-subscription',
                ),
            ),
        ).rejects.toMatchObject({
            status: 402,
            message: (golden.output as { json: { message: string } }).json
                .message,
        });
        await expect(
            portability.importData(
                loadFixtureJson(
                    'data-portability',
                    'import-requires-subscription',
                ),
            ),
        ).rejects.toBeInstanceOf(PremiumRequiredError);
        expect(await tableRows(harness)).toEqual({
            playbackProgressRows: [],
            accountDailyActivityRows: [],
        });
    });

    it('imports a file exported by the legacy app, byte for byte', async () => {
        const { harness, portability } = await setup();
        await harness.credentials.upsert({
            username: 's4444444',
            password: 'p',
        });
        const legacyFile =
            '{"exportedAt":"2026-07-10T12:00:00+00:00","accounts":{"s4444444":7},"playbackProgress":[{"username":"s4444444","cid":"1002","activityId":"N-2","durationSeconds":300,"positionSeconds":10.5,"hunguUploadSuccess":null}],"accountDailyActivities":[{"username":"s4444444","activityDate":"2026-07-09","totalSeconds":600}]}';

        const result = await portability.importFile(legacyFile);

        expect(result).toEqual({
            importedAccountsCount: 1,
            skippedUsernames: [],
            importedPlaybackProgressCount: 1,
            importedAccountDailyActivitiesCount: 1,
        });
        expect(
            (await tableRows(harness)).playbackProgressRows[0],
        ).toMatchObject({ hungu_upload_success: null });
    });

    it('round-trips its own export', async () => {
        const source = await setup();
        const id = await source.harness.credentials.upsert({
            username: 's1',
            password: 'p',
        });
        await source.harness.db.insert(playbackProgress).values({
            accountId: id,
            cid: 'c',
            activityId: 'a',
            durationSeconds: 5,
            positionSeconds: 1.5,
            hunguUploadSuccess: false,
        });
        const file = await source.portability.exportFile();

        const target = await setup();
        await target.harness.credentials.upsert({
            username: 's1',
            password: 'p',
        });
        await target.portability.importFile(file.contents);

        expect((await tableRows(target.harness)).playbackProgressRows).toEqual([
            {
                cid: 'c',
                activity_id: 'a',
                duration_seconds: 5,
                position_seconds: 1.5,
                hungu_upload_success: false,
            },
        ]);
    });

    it('validates the payload', async () => {
        const { portability } = await setup();

        await expect(
            portability.importData({} as DataImportInput),
        ).rejects.toBeInstanceOf(ValidationError);
        await expect(portability.importFile('not json')).rejects.toBeInstanceOf(
            ValidationError,
        );
        await expect(
            portability.importData({
                accounts: { a: 1 },
                accountDailyActivities: [
                    {
                        username: 'a',
                        activityDate: '2026-13-40',
                        totalSeconds: 1,
                    },
                ],
            }),
        ).rejects.toBeInstanceOf(ValidationError);
        await expect(
            portability.importData({
                accounts: { a: 1 },
                playbackProgress: [
                    {
                        username: 'a',
                        cid: 'c',
                        activityId: 'a',
                        durationSeconds: -1,
                        positionSeconds: 0,
                        hunguUploadSuccess: null,
                    },
                ],
            }),
        ).rejects.toBeInstanceOf(ValidationError);
    });
});

describe('mergeAccountData last-write-wins', () => {
    it('skips an incoming row when the local row is newer, but always applies rows without a timestamp', async () => {
        const { harness } = await setup();
        const id = await harness.credentials.upsert({
            username: 's1',
            password: 'p',
        });
        const localIds = new Map([['s1', id]]);
        const deps = { db: harness.db, clock: harness.clock };
        const item = {
            username: 's1',
            cid: 'c',
            activityId: 'a',
            durationSeconds: 10,
            positionSeconds: 1,
            hunguUploadSuccess: true,
        };

        // Local row written "now" (2026-10-01).
        await mergeAccountData(deps, [item], [], localIds);

        const stale = await mergeAccountData(
            deps,
            [
                {
                    ...item,
                    durationSeconds: 99,
                    updatedAt: '2026-01-01T00:00:00+00:00',
                },
            ],
            [],
            localIds,
        );
        expect(stale.importedPlaybackProgressCount).toBe(0);

        const newer = await mergeAccountData(
            deps,
            [
                {
                    ...item,
                    durationSeconds: 55,
                    updatedAt: '2027-01-01T00:00:00+00:00',
                },
            ],
            [],
            localIds,
        );
        expect(newer.importedPlaybackProgressCount).toBe(1);

        const noTimestamp = await mergeAccountData(
            deps,
            [{ ...item, durationSeconds: 77 }],
            [],
            localIds,
        );
        expect(noTimestamp.importedPlaybackProgressCount).toBe(1);
        expect(
            (await tableRows(harness)).playbackProgressRows[0].duration_seconds,
        ).toBe(77);
    });
});
