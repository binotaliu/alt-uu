import type { SqlValue } from '../platform';

const LARAVEL_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?)?$/;

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Parses a Laravel SQLite datetime column. Eloquent writes
 * `Y-m-d H:i:s` (optionally with fractional seconds) in the app timezone,
 * which is `UTC` in the legacy `config/app.php`. Strings that carry an
 * explicit offset (ISO 8601) are honoured. Unparseable values become null.
 */
export function parseLaravelDateTime(value: SqlValue | undefined): Date | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const trimmed = value.trim();
  const match = LARAVEL_DATETIME.exec(trimmed);

  if (match !== null) {
    const [, year, month, day, hour, minute, second, fraction] = match;
    const milliseconds =
      fraction === undefined ? 0 : Math.floor(Number(`0.${fraction}`) * 1000);

    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour ?? 0),
        Number(minute ?? 0),
        Number(second ?? 0),
        milliseconds,
      ),
    );
  }

  const parsed = new Date(trimmed);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** `Date::parse($utc)->setTimezone('Asia/Taipei')->toDateString()` (no DST). */
export function toTaipeiDateString(date: Date): string {
  return new Date(date.getTime() + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
}
