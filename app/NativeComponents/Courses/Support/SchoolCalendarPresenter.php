<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses\Support;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Illuminate\Support\Facades\Date;
use Throwable;

/**
 * Pure presentation logic of the school calendar tab (SchoolCalendarTab.vue):
 * status, countdown card and month grouping. Dates are Taiwan calendar days.
 */
final class SchoolCalendarPresenter
{
    private const string TIMEZONE = 'Asia/Taipei';

    private const array WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

    /**
     * @param  array<int, array<string, mixed>>  $events  NouToolsSchoolCalendarController payload
     * @return array{countdown: array<string, mixed>|null, upcoming: list<array<string, mixed>>, ended: list<array<string, mixed>>, total: int}
     */
    public static function present(array $events, ?DateTimeInterface $now = null): array
    {
        $today = self::today($now);

        $normalized = array_map(
            static fn (array $event): array => self::normalize($event, $today),
            array_values(array_filter($events, is_array(...))),
        );

        usort($normalized, static fn (array $a, array $b): int => strcmp($a['startDate'], $b['startDate']));

        $countdownEvents = array_values(array_filter($normalized, static fn (array $e): bool => $e['isCountdown']));
        $countdown = null;

        foreach (['upcoming', 'ongoing'] as $wanted) {
            foreach ($countdownEvents as $candidate) {
                if ($candidate['status'] === $wanted) {
                    $countdown = $candidate;
                    break 2;
                }
            }
        }

        $timeline = array_values(array_filter($normalized, static fn (array $e): bool => $countdown === null
            || $e['name'] !== $countdown['name']
            || $e['startDate'] !== $countdown['startDate']
            || $e['endDate'] !== $countdown['endDate']));

        $upcoming = array_values(array_filter($timeline, static fn (array $e): bool => $e['status'] !== 'ended'));
        $ended = array_values(array_filter($timeline, static fn (array $e): bool => $e['status'] === 'ended'));

        return [
            'countdown' => $countdown,
            'upcoming' => self::groupByMonth($upcoming),
            'ended' => self::groupByMonth($ended),
            'upcomingCount' => count($upcoming),
            'endedCount' => count($ended),
            'total' => count($normalized),
        ];
    }

    /**
     * @param  array<string, mixed>  $event
     * @return array<string, mixed>
     */
    private static function normalize(array $event, DateTimeImmutable $today): array
    {
        $startDate = (string) ($event['startDate'] ?? '');
        $endDate = (string) ($event['endDate'] ?? $startDate);
        $start = self::dayStart($startDate);
        $end = self::dayStart($endDate);

        $status = 'upcoming';

        if ($start !== null && $end !== null) {
            if ($today > $end) {
                $status = 'ended';
            } elseif ($today >= $start) {
                $status = 'ongoing';
            }
        }

        return [
            'name' => (string) ($event['name'] ?? ''),
            'startDate' => $startDate,
            'endDate' => $endDate,
            'isCountdown' => (bool) ($event['isCountdown'] ?? false),
            'status' => $status,
            'daysUntil' => $start === null ? 0 : (int) ceil(($start->getTimestamp() - $today->getTimestamp()) / 86400),
            'rangeLabel' => self::rangeLabel($startDate, $endDate),
            'monthKey' => $start === null ? $startDate : $start->format('Y-m'),
            'monthLabel' => $start === null ? $startDate : $start->format('Y年n月'),
        ];
    }

    private static function today(?DateTimeInterface $now): DateTimeImmutable
    {
        $now ??= Date::now();

        return (new DateTimeImmutable('@'.$now->getTimestamp()))
            ->setTimezone(new DateTimeZone(self::TIMEZONE))
            ->setTime(0, 0);
    }

    private static function dayStart(string $date): ?DateTimeImmutable
    {
        try {
            return new DateTimeImmutable("{$date}T00:00:00+08:00");
        } catch (Throwable) {
            return null;
        }
    }

    private static function dateWithWeekday(string $date): string
    {
        $parsed = self::dayStart($date);

        if ($parsed === null) {
            return $date;
        }

        return sprintf('%d/%d (週%s)', (int) $parsed->format('n'), (int) $parsed->format('j'), self::WEEKDAYS[(int) $parsed->format('w')]);
    }

    private static function rangeLabel(string $startDate, string $endDate): string
    {
        return $startDate === $endDate
            ? self::dateWithWeekday($startDate)
            : self::dateWithWeekday($startDate).' - '.self::dateWithWeekday($endDate);
    }

    /**
     * @param  list<array<string, mixed>>  $events
     * @return list<array{monthKey: string, monthLabel: string, events: list<array<string, mixed>>}>
     */
    private static function groupByMonth(array $events): array
    {
        $groups = [];

        foreach ($events as $event) {
            $key = $event['monthKey'];
            $groups[$key] ??= ['monthKey' => $key, 'monthLabel' => $event['monthLabel'], 'events' => []];
            $groups[$key]['events'][] = $event;
        }

        return array_values($groups);
    }
}
