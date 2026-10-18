import type { ActivityDay } from '@altuu/core';

export type HeatmapCell = ActivityDay | null;

export const MONTH_LABELS = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
] as const;

export const WEEKDAY_LABELS = ['', '一', '', '三', '', '五', ''] as const;

/** Parses a `Y-m-d` string as a local calendar day (no timezone shifts). */
export function parseDay(date: string): Date {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);

  return new Date(year, month - 1, day);
}

/** Heat level 0 (nothing) to 4 (an hour or more). */
export function levelFor(seconds: number): 0 | 1 | 2 | 3 | 4 {
  if (seconds <= 0) {
    return 0;
  }

  if (seconds < 900) {
    return 1;
  }

  if (seconds < 1800) {
    return 2;
  }

  if (seconds < 3600) {
    return 3;
  }

  return 4;
}

/** Columns of seven cells (Sunday first), padded with nulls at both ends. */
export function buildWeeks(days: ActivityDay[]): HeatmapCell[][] {
  if (days.length === 0) {
    return [];
  }

  const firstWeekday = parseDay(days[0]!.date).getDay();
  const cells: HeatmapCell[] = [
    ...Array.from({ length: firstWeekday }, (): HeatmapCell => null),
    ...days,
  ];

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: HeatmapCell[][] = [];

  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return weeks;
}

/** The month name above a week column, only where the month changes. */
export function monthLabelFor(
  weeks: HeatmapCell[][],
  weekIndex: number,
): string {
  const firstCell = weeks[weekIndex]?.find((cell) => cell !== null);

  if (!firstCell) {
    return '';
  }

  const month = parseDay(firstCell.date).getMonth();
  const previousCell = weeks[weekIndex - 1]?.find((cell) => cell !== null);
  const previousMonth = previousCell
    ? parseDay(previousCell.date).getMonth()
    : null;

  return month !== previousMonth ? MONTH_LABELS[month]! : '';
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) {
    return '無學習紀錄';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return hours > 0 ? `${hours} 小時 ${minutes} 分鐘` : `${minutes} 分鐘`;
}

export function formatDateLong(date: string): string {
  const parsed = parseDay(date);

  return `${parsed.getFullYear()} 年 ${parsed.getMonth() + 1} 月 ${parsed.getDate()} 日`;
}

export function formatDateSlash(date: string): string {
  const parsed = parseDay(date);

  return `${parsed.getFullYear()}/${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

export function cellTitle(cell: HeatmapCell): string {
  return cell
    ? `${formatDateLong(cell.date)}・${formatDuration(cell.seconds)}`
    : '';
}

/** First day of the running streak (today may still be empty). */
export function currentStreakStartDate(
  days: ActivityDay[],
  currentStreak: number,
): string | null {
  if (currentStreak <= 0 || days.length === 0) {
    return null;
  }

  let index = days.length - 1;

  if (days[index]!.seconds <= 0) {
    index -= 1;
  }

  const startIndex = index - currentStreak + 1;

  return startIndex < 0 || startIndex >= days.length
    ? null
    : days[startIndex]!.date;
}

export function longestStreakRange(
  days: ActivityDay[],
  longestStreak: number,
): { start: string; end: string } | null {
  if (longestStreak <= 0 || days.length === 0) {
    return null;
  }

  let runStart = 0;
  let runLength = 0;
  let bestStart = 0;
  let bestEnd = 0;
  let bestLength = 0;

  days.forEach((day, index) => {
    if (day.seconds > 0) {
      if (runLength === 0) {
        runStart = index;
      }

      runLength += 1;

      if (runLength > bestLength) {
        bestLength = runLength;
        bestStart = runStart;
        bestEnd = index;
      }
    } else {
      runLength = 0;
    }
  });

  return bestLength === 0
    ? null
    : { start: days[bestStart]!.date, end: days[bestEnd]!.date };
}

/** Deterministic placeholder data shown behind the Alt UU+ upsell. */
export function buildSampleActivity(today: Date = new Date()): {
  days: ActivityDay[];
  currentStreak: number;
  longestStreak: number;
  longestStudyDayDate: string | null;
  longestStudyDaySeconds: number;
} {
  const totalDays = 182;
  const days: ActivityDay[] = [];

  for (let offset = totalDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);

    const value = Math.sin(offset * 12.9898) * 43758.5453;
    const roll = value - Math.floor(value);
    const seconds = roll < 0.35 ? 0 : Math.round(roll * 5400);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    days.push({ date: iso, seconds });
  }

  return {
    days,
    currentStreak: 6,
    longestStreak: 18,
    longestStudyDaySeconds: 5400,
    longestStudyDayDate: days.at(-8)?.date ?? null,
  };
}
