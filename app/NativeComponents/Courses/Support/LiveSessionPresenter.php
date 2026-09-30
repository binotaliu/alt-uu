<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses\Support;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Illuminate\Support\Facades\Date;
use Throwable;

/**
 * Pure presentation logic of the live sessions tab (LiveSessionsTab.vue):
 * flattening NOU Tools classes into dated sessions, status, month grouping and
 * time zone aware formatting.
 */
final class LiveSessionPresenter
{
    public const string TAIWAN_TIMEZONE = 'Asia/Taipei';

    private const array WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

    /**
     * @param  array<int, array<string, mixed>>  $items  NouToolsLiveSessionsController payload
     * @return array{upcoming: list<array<string, mixed>>, ended: list<array<string, mixed>>, total: int}
     */
    public static function present(array $items, string $displayTimezone, string $systemTimezone, ?DateTimeInterface $now = null): array
    {
        $timezone = self::effectiveTimezone($displayTimezone, $systemTimezone);
        $now ??= Date::now();
        $sessions = [];

        foreach ($items as $item) {
            foreach ((array) ($item['sessions'] ?? []) as $slot) {
                if (! is_array($slot)) {
                    continue;
                }

                $sessions[] = self::flatten($item, $slot, $displayTimezone, $timezone, $now);
            }
        }

        usort($sessions, static function (array $left, array $right): int {
            $leftEnded = $left['status'] === 'ended';

            if ($leftEnded !== ($right['status'] === 'ended')) {
                return $leftEnded ? 1 : -1;
            }

            return $left['sortKey'] <=> $right['sortKey'];
        });

        $upcoming = array_values(array_filter($sessions, static fn (array $s): bool => $s['status'] !== 'ended'));
        $ended = array_values(array_filter($sessions, static fn (array $s): bool => $s['status'] === 'ended'));

        return [
            'upcoming' => self::groupByMonth($upcoming),
            'ended' => self::groupByMonth($ended),
            'total' => count($sessions),
            'upcomingCount' => count($upcoming),
            'endedCount' => count($ended),
        ];
    }

    public static function effectiveTimezone(string $displayTimezone, string $systemTimezone): string
    {
        return $displayTimezone === 'local' ? $systemTimezone : self::TAIWAN_TIMEZONE;
    }

    /**
     * The zone the device reports, or null when it cannot be told apart from
     * PHP's default (UTC on device), in which case the selector is hidden.
     */
    public static function detectedTimezone(): ?string
    {
        $zone = date_default_timezone_get();

        return $zone === 'UTC' || $zone === 'Etc/UTC' ? null : $zone;
    }

    public static function offsetMinutes(string $timezone): int
    {
        return intdiv((new DateTimeZone($timezone))->getOffset(new DateTimeImmutable('now')), 60);
    }

    public static function formatUtcOffset(int $totalMinutes): string
    {
        $sign = $totalMinutes >= 0 ? '+' : '-';
        $absolute = abs($totalMinutes);

        return sprintf('UTC%s%02d:%02d', $sign, intdiv($absolute, 60), $absolute % 60);
    }

    /**
     * Stable short key for tap handlers (the session id holds characters that
     * do not survive directive interpolation).
     */
    public static function tapKey(string $sessionId): string
    {
        return 's'.dechex(crc32($sessionId));
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  array<string, mixed>  $slot
     * @return array<string, mixed>
     */
    private static function flatten(array $item, array $slot, string $displayTimezone, string $timezone, DateTimeInterface $now): array
    {
        $date = (string) ($slot['date'] ?? '');
        $startTime = (string) ($slot['startTime'] ?? '');
        $endTime = (string) ($slot['endTime'] ?? '');
        $startAt = self::toDate($date, $startTime);
        $endAt = self::toDate($date, $endTime);

        $id = sprintf('%s-%s-%s-%s-%s', $item['accountId'] ?? 'NA', $item['courseId'] ?? '', $item['classCode'] ?? 'NA', $date, $startTime);

        return [
            'id' => $id,
            'tapKey' => self::tapKey($id),
            'accountLabel' => (string) ($item['accountLabel'] ?? ''),
            'accountId' => $item['accountId'] ?? null,
            'courseId' => (string) ($item['courseId'] ?? ''),
            'courseName' => (string) ($item['courseName'] ?? ''),
            'className' => ($item['className'] ?? null) ?: '未提供班級名稱',
            'typeLabel' => ($item['typeLabel'] ?? null) ?: '未知班別',
            'teacher' => self::teacherLabel($item['teacherName'] ?? null),
            'link' => ($item['link'] ?? null) ?: null,
            'backupClassroomUrl' => ($item['backupClassroomUrl'] ?? null) ?: null,
            'monthDay' => self::formatMonthDay($startAt, $date, $timezone),
            'weekday' => self::formatWeekday($startAt, $timezone),
            'startClock' => self::formatClock($startAt, $startTime, $date, $displayTimezone, $timezone),
            'endClock' => self::formatClock($endAt, $endTime, $date, $displayTimezone, $timezone),
            'monthKey' => self::monthKey($startAt, $date, $timezone),
            'monthLabel' => self::monthLabel($startAt, $date, $timezone),
            'status' => self::status($startAt, $endAt, $now),
            'sortKey' => $startAt?->getTimestamp() ?? 0,
        ];
    }

    public static function toDate(string $date, string $time): ?DateTimeImmutable
    {
        if ($date === '' || $time === '') {
            return null;
        }

        $normalized = str_contains($time, '+') ? $time : $time.'+08:00';

        try {
            return new DateTimeImmutable("{$date}T{$normalized}");
        } catch (Throwable) {
            return null;
        }
    }

    private static function status(?DateTimeImmutable $startAt, ?DateTimeImmutable $endAt, DateTimeInterface $now): string
    {
        if ($startAt === null || $endAt === null) {
            return 'upcoming';
        }

        if ($now < $startAt) {
            return 'upcoming';
        }

        return $now > $endAt ? 'ended' : 'ongoing';
    }

    private static function teacherLabel(mixed $name): string
    {
        return is_string($name) && trim($name) !== '' ? trim($name) : '未提供';
    }

    private static function inZone(DateTimeImmutable $date, string $timezone): DateTimeImmutable
    {
        return $date->setTimezone(new DateTimeZone($timezone));
    }

    private static function formatMonthDay(?DateTimeImmutable $date, string $fallback, string $timezone): string
    {
        return $date === null ? $fallback : self::inZone($date, $timezone)->format('m/d');
    }

    private static function formatWeekday(?DateTimeImmutable $date, string $timezone): string
    {
        return $date === null ? '' : '週'.self::WEEKDAYS[(int) self::inZone($date, $timezone)->format('w')];
    }

    private static function formatClock(?DateTimeImmutable $date, string $fallbackTime, string $fallbackDate, string $displayTimezone, string $timezone): string
    {
        if ($date === null) {
            return substr($fallbackTime, 0, 5);
        }

        $local = self::inZone($date, $timezone);
        $showDate = $displayTimezone === 'local'
            && $timezone !== self::TAIWAN_TIMEZONE
            && $local->format('Y-m-d') !== $fallbackDate;

        return $showDate ? $local->format('m/d H:i') : $local->format('H:i');
    }

    private static function monthKey(?DateTimeImmutable $date, string $fallback, string $timezone): string
    {
        return $date === null ? $fallback : self::inZone($date, $timezone)->format('Y-m');
    }

    private static function monthLabel(?DateTimeImmutable $date, string $fallback, string $timezone): string
    {
        return $date === null ? $fallback : self::inZone($date, $timezone)->format('Y年n月');
    }

    /**
     * @param  list<array<string, mixed>>  $sessions
     * @return list<array{monthKey: string, monthLabel: string, sessions: list<array<string, mixed>>}>
     */
    private static function groupByMonth(array $sessions): array
    {
        $groups = [];

        foreach ($sessions as $session) {
            $key = $session['monthKey'];
            $groups[$key] ??= ['monthKey' => $key, 'monthLabel' => $session['monthLabel'], 'sessions' => []];
            $groups[$key]['sessions'][] = $session;
        }

        return array_values($groups);
    }
}
