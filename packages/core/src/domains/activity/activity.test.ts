import { describe, expect, it } from 'vitest';
import { accountDailyActivities } from '../../db/schema';
import { createHarness, setClockTo } from '../account/testing';
import { createActivityServices } from './index';

// 2026-07-11 12:00 Asia/Taipei
const NOW = new Date('2026-07-11T04:00:00Z');

async function setup() {
    const harness = await createHarness();
    setClockTo(harness.clock, NOW);
    const first = await harness.credentials.upsert({
        username: 'a',
        password: 'p',
    });
    const activity = createActivityServices({
        db: harness.db,
        activeProfile: harness.activeProfile,
        credentials: harness.credentials,
        clock: harness.clock,
    });

    async function addActivity(
        accountId: number,
        date: string,
        totalSeconds: number,
    ) {
        await harness.db
            .insert(accountDailyActivities)
            .values({ accountId, activityDate: date, totalSeconds });
    }

    return { harness, first, activity, addActivity };
}

// Ported from tests/Feature/Activity/AccountActivityTest.php
describe('activity heatmap', () => {
    it('computes streaks and the longest study day', async () => {
        const { first, activity, addActivity } = await setup();
        const seconds: Record<string, number> = {
            '2026-07-01': 1000,
            '2026-07-02': 2000,
            '2026-07-03': 9000,
            '2026-07-04': 1500,
            '2026-07-05': 1800,
            '2026-07-10': 1200,
            '2026-07-11': 600,
        };

        for (const [date, total] of Object.entries(seconds)) {
            await addActivity(first, date, total);
        }

        const heatmap = await activity.getHeatmap();

        expect(heatmap).toMatchObject({
            currentStreak: 2,
            longestStreak: 5,
            longestStudyDayDate: '2026-07-03',
            longestStudyDaySeconds: 9000,
            hasMultipleAccounts: false,
        });
        // Carbon: 2026-07-11 minus six months plus one day = 2026-01-12, inclusive of today.
        expect(heatmap.days[0].date).toBe('2026-01-12');
        expect(heatmap.days.at(-1)?.date).toBe('2026-07-11');
        expect(heatmap.days).toHaveLength(181);
    });

    it('combines every account when allAccounts is requested', async () => {
        const { harness, first, activity, addActivity } = await setup();
        const other = await harness.credentials.upsert({
            username: 'b',
            password: 'p',
        });
        await harness.activeProfile.set(first);
        await addActivity(first, '2026-07-10', 1000);
        await addActivity(other, '2026-07-10', 500);
        await addActivity(other, '2026-07-11', 300);

        const heatmap = await activity.getHeatmap({ allAccounts: true });
        const secondsOf = (date: string) =>
            heatmap.days.find((day) => day.date === date)?.seconds;

        expect(heatmap.hasMultipleAccounts).toBe(true);
        expect(secondsOf('2026-07-10')).toBe(1500);
        expect(secondsOf('2026-07-11')).toBe(300);
    });

    it('ignores allAccounts with a single account', async () => {
        const { first, activity, addActivity } = await setup();
        await addActivity(first, '2026-07-11', 60);

        const heatmap = await activity.getHeatmap({ allAccounts: true });

        expect(heatmap.hasMultipleAccounts).toBe(false);
        expect(heatmap.currentStreak).toBe(1);
    });

    it('does not leak another account daily activity', async () => {
        const { harness, first, activity, addActivity } = await setup();
        const other = await harness.credentials.upsert({
            username: 'b',
            password: 'p',
        });
        await harness.activeProfile.set(first);
        await addActivity(other, '2026-07-11', 5000);

        const heatmap = await activity.getHeatmap();

        expect(heatmap).toMatchObject({
            currentStreak: 0,
            longestStreak: 0,
            longestStudyDaySeconds: 0,
            longestStudyDayDate: null,
        });
    });

    it('returns an empty heatmap when no account is active', async () => {
        const { harness, activity } = await setup();
        await harness.activeProfile.clear();

        const heatmap = await activity.getHeatmap();

        expect(heatmap).toMatchObject({
            currentStreak: 0,
            longestStreak: 0,
            longestStudyDaySeconds: 0,
            longestStudyDayDate: null,
        });
        expect(heatmap.days.every((day) => day.seconds === 0)).toBe(true);
    });

    it('clamps the range start when the target month is shorter', async () => {
        const { harness, activity } = await setup();
        // 2026-08-31 12:00 Taipei: six months back is 2026-02-28 (no overflow), plus one day.
        setClockTo(harness.clock, new Date('2026-08-31T04:00:00Z'));

        const heatmap = await activity.getHeatmap();

        expect(heatmap.days[0].date).toBe('2026-03-01');
    });
});
