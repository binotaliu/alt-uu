import {
    buildWeeks,
    currentStreakStartDate,
    formatDuration,
    levelFor,
    longestStreakRange,
    monthLabelFor,
} from './activity';

const day = (date: string, seconds: number) => ({ date, seconds });

describe('activity helpers', () => {
    it('maps study seconds to heat levels', () => {
        expect([0, 1, 899, 900, 1799, 1800, 3599, 3600].map(levelFor)).toEqual([
            0, 1, 1, 2, 2, 3, 3, 4,
        ]);
    });

    it('pads the first and last week to full Sunday-first columns', () => {
        // 2026-10-14 is a Wednesday.
        const weeks = buildWeeks([
            day('2026-10-14', 60),
            day('2026-10-15', 0),
            day('2026-10-16', 60),
        ]);

        expect(weeks).toHaveLength(1);
        expect(weeks[0]?.map((cell) => cell?.date ?? null)).toEqual([
            null,
            null,
            null,
            '2026-10-14',
            '2026-10-15',
            '2026-10-16',
            null,
        ]);
    });

    it('labels a week only where the month changes', () => {
        const days = [];

        for (let offset = 0; offset < 14; offset += 1) {
            const date = new Date(2026, 9, 26 + offset);
            days.push(
                day(
                    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
                    60,
                ),
            );
        }

        const weeks = buildWeeks(days);
        const labels = weeks.map((_, index) => monthLabelFor(weeks, index));

        expect(labels[0]).toBe('10月');
        expect(labels.filter((label) => label === '11月')).toHaveLength(1);
    });

    it('finds the streak start even when today is still empty', () => {
        const days = [
            day('2026-10-14', 0),
            day('2026-10-15', 5),
            day('2026-10-16', 5),
            day('2026-10-17', 0),
        ];

        expect(currentStreakStartDate(days, 2)).toBe('2026-10-15');
        expect(currentStreakStartDate(days, 0)).toBeNull();
    });

    it('finds the longest streak range', () => {
        const days = [
            day('2026-10-10', 5),
            day('2026-10-11', 0),
            day('2026-10-12', 5),
            day('2026-10-13', 5),
            day('2026-10-14', 5),
            day('2026-10-15', 0),
        ];

        expect(longestStreakRange(days, 3)).toEqual({
            start: '2026-10-12',
            end: '2026-10-14',
        });
        expect(longestStreakRange(days, 0)).toBeNull();
    });

    it('formats durations in Chinese', () => {
        expect(formatDuration(0)).toBe('無學習紀錄');
        expect(formatDuration(1500)).toBe('25 分鐘');
        expect(formatDuration(3900)).toBe('1 小時 5 分鐘');
    });
});
