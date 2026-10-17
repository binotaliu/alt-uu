import { describe, expect, it } from 'vitest';
import { loadExpected, loadFixtureJson } from '../../../test/fixtures';
import { playbackProgress } from '../../db/schema';
import { createHarness } from '../account/testing';
import { createPlaybackServices } from './index';

interface RowFixture {
    account: 'active' | 'other';
    cid: string;
    activity_id: string;
    duration_seconds: number;
    position_seconds: number;
    media_duration_seconds?: number;
    hungu_upload_success: boolean;
    updated_at?: string;
}

async function seed(fixtureName: string) {
    const harness = await createHarness();
    const fixture = loadFixtureJson<{ playbackProgressRows: RowFixture[] }>(
        'study-time',
        fixtureName,
    );
    const active = await harness.credentials.upsert({
        username: 'active',
        password: 'p',
    });
    const other = await harness.credentials.upsert({
        username: 'other',
        password: 'p',
    });
    await harness.activeProfile.set(active);
    const now = harness.clock.now().getTime();

    for (const row of fixture.playbackProgressRows) {
        const updatedAt =
            row.updated_at === 'now - 10 minutes'
                ? new Date(now - 10 * 60_000)
                : new Date(now);
        await harness.db.insert(playbackProgress).values({
            accountId: row.account === 'active' ? active : other,
            cid: row.cid,
            activityId: row.activity_id,
            durationSeconds: row.duration_seconds,
            positionSeconds: row.position_seconds,
            mediaDurationSeconds: row.media_duration_seconds ?? null,
            hunguUploadSuccess: row.hungu_upload_success,
            createdAt: updatedAt,
            updatedAt,
        });
    }

    return {
        harness,
        playback: createPlaybackServices({
            db: harness.db,
            activeProfile: harness.activeProfile,
        }),
    };
}

// Ported from tests/Feature/StudyTime/StudyTimeTest.php
describe('playback services', () => {
    it('returns the active account playback progress with camelCase keys', async () => {
        const { playback } = await seed('playback-progress-api');
        const expected = loadExpected('study-time', 'playback-progress-api')
            .cases[0].expected as {
            progress: object;
            progressMissingKeys: string[];
        };

        const { progress } = await playback.getProgress('1001', 'N-1');

        expect(progress).toMatchObject(expected.progress);

        for (const key of expected.progressMissingKeys) {
            expect(progress).not.toHaveProperty(key);
        }

        expect(progress?.updatedAt).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/,
        );
    });

    it('returns null progress when nothing was recorded', async () => {
        const { playback } = await seed('playback-progress-api');

        expect(await playback.getProgress('1001', 'N-404')).toEqual({
            progress: null,
        });
    });

    it('returns the most recently updated activity as last seen material', async () => {
        const { playback } = await seed('last-seen-material');
        const [withRows, withoutRows] = loadExpected(
            'study-time',
            'last-seen-material',
        ).cases;

        expect(await playback.getLastSeenMaterial('1001')).toMatchObject(
            withRows.expected as object,
        );
        expect(await playback.getLastSeenMaterial('9999')).toEqual(
            withoutRows.expected,
        );
    });
});
