<?php

declare(strict_types=1);

namespace App\NativeComponents\Support;

use AltUU\Domains\Activity\ViewModels\ActivityDayViewModel;
use Carbon\CarbonImmutable;

/**
 * Pure calculations behind ActivityHeatmap.vue: week grid, intensity levels,
 * streak ranges and Chinese duration/date formatting.
 */
final class ActivityHeatmapData
{
    /**
     * Normalise view models or arrays into `['date' => 'Y-m-d', 'seconds' => int]`.
     *
     * @param  iterable<ActivityDayViewModel|array<string, mixed>>  $days
     * @return list<array{date: string, seconds: int}>
     */
    public static function normalize(iterable $days): array
    {
        $result = [];

        foreach ($days as $day) {
            $result[] = $day instanceof ActivityDayViewModel
                ? ['date' => $day->date, 'seconds' => $day->seconds]
                : ['date' => (string) $day['date'], 'seconds' => (int) $day['seconds']];
        }

        return $result;
    }

    /**
     * 0 = no activity, 1..4 by study time (15 min, 30 min, 60 min thresholds).
     */
    public static function levelFor(int $seconds): int
    {
        return match (true) {
            $seconds <= 0 => 0,
            $seconds < 900 => 1,
            $seconds < 1800 => 2,
            $seconds < 3600 => 3,
            default => 4,
        };
    }

    /**
     * Sunday-first columns of seven cells (null pads the first and last week).
     *
     * @param  list<array{date: string, seconds: int}>  $days
     * @return list<list<array{date: string, seconds: int}|null>>
     */
    public static function weeks(array $days): array
    {
        if ($days === []) {
            return [];
        }

        $cells = array_fill(0, CarbonImmutable::parse($days[0]['date'])->dayOfWeek, null);
        array_push($cells, ...$days);

        while (count($cells) % 7 !== 0) {
            $cells[] = null;
        }

        return array_chunk($cells, 7);
    }

    /**
     * Keeps only the most recent `$visibleWeeks` columns (0 keeps all).
     *
     * @param  list<list<array{date: string, seconds: int}|null>>  $weeks
     * @return list<list<array{date: string, seconds: int}|null>>
     */
    public static function recentWeeks(array $weeks, int $visibleWeeks): array
    {
        if ($visibleWeeks <= 0 || count($weeks) <= $visibleWeeks) {
            return $weeks;
        }

        return array_slice($weeks, -$visibleWeeks);
    }

    /**
     * Month label ("10月") for the first week that starts a new month, else ''.
     *
     * @param  list<list<array{date: string, seconds: int}|null>>  $weeks
     */
    public static function monthLabelFor(array $weeks, int $index): string
    {
        $first = self::firstCell($weeks[$index] ?? []);

        if ($first === null) {
            return '';
        }

        $month = CarbonImmutable::parse($first['date'])->month;
        $previous = $index > 0 ? self::firstCell($weeks[$index - 1]) : null;
        $previousMonth = $previous !== null ? CarbonImmutable::parse($previous['date'])->month : null;

        return $month !== $previousMonth ? $month.'月' : '';
    }

    public static function formatDuration(int $seconds): string
    {
        if ($seconds <= 0) {
            return '無學習紀錄';
        }

        $hours = intdiv($seconds, 3600);
        $minutes = intdiv($seconds % 3600, 60);

        return $hours > 0 ? "{$hours} 小時 {$minutes} 分鐘" : "{$minutes} 分鐘";
    }

    public static function formatDate(string $date): string
    {
        $parsed = CarbonImmutable::parse($date);

        return "{$parsed->year}年{$parsed->month}月{$parsed->day}日";
    }

    public static function formatDateSlash(string $date): string
    {
        $parsed = CarbonImmutable::parse($date);

        return "{$parsed->year}/{$parsed->month}/{$parsed->day}";
    }

    /**
     * @param  list<array{date: string, seconds: int}>  $days
     */
    public static function currentStreakStartDate(array $days, int $currentStreak): ?string
    {
        if ($currentStreak <= 0 || $days === []) {
            return null;
        }

        $index = count($days) - 1;

        if ($days[$index]['seconds'] <= 0) {
            $index--;
        }

        $startIndex = $index - $currentStreak + 1;

        return $days[$startIndex]['date'] ?? null;
    }

    /**
     * @param  list<array{date: string, seconds: int}>  $days
     * @return array{start: string, end: string}|null
     */
    public static function longestStreakRange(array $days, int $longestStreak): ?array
    {
        if ($longestStreak <= 0 || $days === []) {
            return null;
        }

        $runStart = 0;
        $runLength = 0;
        $best = ['length' => 0, 'start' => 0, 'end' => 0];

        foreach ($days as $index => $day) {
            if ($day['seconds'] > 0) {
                if ($runLength === 0) {
                    $runStart = $index;
                }

                $runLength++;

                if ($runLength > $best['length']) {
                    $best = ['length' => $runLength, 'start' => $runStart, 'end' => $index];
                }
            } else {
                $runLength = 0;
            }
        }

        if ($best['length'] === 0) {
            return null;
        }

        return ['start' => $days[$best['start']]['date'], 'end' => $days[$best['end']]['date']];
    }

    /**
     * @param  list<array{date: string, seconds: int}|null>  $week
     * @return array{date: string, seconds: int}|null
     */
    private static function firstCell(array $week): ?array
    {
        foreach ($week as $cell) {
            if ($cell !== null) {
                return $cell;
            }
        }

        return null;
    }
}
