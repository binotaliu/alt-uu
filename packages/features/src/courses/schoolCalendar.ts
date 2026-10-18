import type { SchoolCalendarEvent } from './courseQueries';

export type EventStatus = 'upcoming' | 'ongoing' | 'ended';

export interface EventPresentation extends SchoolCalendarEvent {
  status: EventStatus;
  daysUntil: number;
  rangeLabel: string;
}

const DAY_MS = 1000 * 60 * 60 * 24;

/** Calendar dates are Taiwan calendar days. */
function dayStart(dateText: string): Date {
  return new Date(`${dateText}T00:00:00+08:00`);
}

const taiwanDate = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    ...options,
  }).format(date);

function formatMonthDay(dateText: string): string {
  const parsed = dayStart(dateText);

  return Number.isNaN(parsed.getTime())
    ? dateText
    : taiwanDate(parsed, { month: 'numeric', day: 'numeric' });
}

function formatDateWithWeekday(dateText: string): string {
  const parsed = dayStart(dateText);
  const weekday = Number.isNaN(parsed.getTime())
    ? ''
    : taiwanDate(parsed, { weekday: 'short' });

  return weekday
    ? `${formatMonthDay(dateText)} (${weekday})`
    : formatMonthDay(dateText);
}

export function formatRangeLabel(startDate: string, endDate: string): string {
  if (startDate === endDate) {
    return formatDateWithWeekday(startDate);
  }

  return `${formatDateWithWeekday(startDate)} - ${formatDateWithWeekday(endDate)}`;
}

/** Device-local calendar day read as a Taiwan midnight (legacy behaviour). */
function todayStart(now: Date): Date {
  const pad = (value: number) => String(value).padStart(2, '0');

  return new Date(
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T00:00:00+08:00`,
  );
}

export function presentCalendar(
  events: readonly SchoolCalendarEvent[],
  now: Date,
): EventPresentation[] {
  const today = todayStart(now);

  return [...events]
    .sort((left, right) => left.startDate.localeCompare(right.startDate))
    .map((event) => {
      const start = dayStart(event.startDate);
      const end = dayStart(event.endDate);
      const daysUntil = Math.ceil((start.getTime() - today.getTime()) / DAY_MS);
      let status: EventStatus = 'upcoming';

      if (today > end) {
        status = 'ended';
      } else if (today >= start && today <= end) {
        status = 'ongoing';
      }

      return {
        ...event,
        status,
        daysUntil,
        rangeLabel: formatRangeLabel(event.startDate, event.endDate),
      };
    });
}

/** First upcoming countdown event, else the ongoing one. */
export function pickCountdownEvent(
  events: readonly EventPresentation[],
): EventPresentation | null {
  const countdowns = events.filter((event) => event.isCountdown);

  return (
    countdowns.find((event) => event.status === 'upcoming') ??
    countdowns.find((event) => event.status === 'ongoing') ??
    null
  );
}

export function groupEventsByMonth(
  events: readonly EventPresentation[],
): Array<{
  monthKey: string;
  monthLabel: string;
  events: EventPresentation[];
}> {
  const groups = new Map<
    string,
    { monthKey: string; monthLabel: string; events: EventPresentation[] }
  >();

  for (const event of events) {
    const start = dayStart(event.startDate);
    const valid = !Number.isNaN(start.getTime());
    const monthKey = valid
      ? new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Taipei',
          year: 'numeric',
          month: '2-digit',
        }).format(start)
      : event.startDate;
    const monthLabel = valid
      ? taiwanDate(start, { year: 'numeric', month: 'long' })
      : event.startDate;
    const block = groups.get(monthKey);

    if (block) {
      block.events.push(event);
    } else {
      groups.set(monthKey, { monthKey, monthLabel, events: [event] });
    }
  }

  return Array.from(groups.values());
}
