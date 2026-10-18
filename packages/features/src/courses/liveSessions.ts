import type { LiveSessionItem } from '@altuu/core';

export type SessionStatus = 'upcoming' | 'ongoing' | 'ended';
export type DisplayTimezone = 'taiwan' | 'local';

export const TAIWAN_TIME_ZONE = 'Asia/Taipei';

export interface FlattenedLiveSession {
    id: string;
    accountId: number | null;
    accountLabel: string;
    courseId: string;
    courseName: string;
    className: string | null;
    classCode: string | null;
    typeLabel: string | null;
    teacherName: string | null;
    link: string | null;
    backupClassroomUrl: string | null;
    date: string;
    startTime: string;
    endTime: string;
    startAt: Date | null;
    endAt: Date | null;
    status: SessionStatus;
}

export interface MonthBlock<T> {
    monthLabel: string;
    monthKey: string;
    items: T[];
}

/** Session times are Taiwan local time unless they carry an offset. */
export function toSessionDate(date: string, time: string): Date | null {
    const normalizedTime = time.includes('+') ? time : `${time}+08:00`;
    const parsed = new Date(`${date}T${normalizedTime}`);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function sessionStatus(
    startAt: Date | null,
    endAt: Date | null,
    now: Date,
): SessionStatus {
    if (!startAt || !endAt) {
        return 'upcoming';
    }

    if (now < startAt) {
        return 'upcoming';
    }

    return now > endAt ? 'ended' : 'ongoing';
}

function text(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

/**
 * One entry per class session, finished ones last, otherwise by start time
 * (legacy LiveSessionsTab `flattenedSessions`).
 */
export function flattenLiveSessions(
    items: readonly LiveSessionItem[],
    now: Date,
): FlattenedLiveSession[] {
    return items
        .flatMap((session) =>
            session.sessions.map((item) => {
                const date = text(item.date);
                const startTime = text(item.startTime);
                const endTime = text(item.endTime);
                const startAt = toSessionDate(date, startTime);
                const endAt = toSessionDate(date, endTime);

                return {
                    id: `${session.accountId ?? 'NA'}-${session.courseId}-${session.classCode ?? 'NA'}-${date}-${startTime}`,
                    accountId: session.accountId,
                    accountLabel: session.accountLabel,
                    courseId: session.courseId,
                    courseName: session.courseName,
                    className: session.className,
                    classCode: session.classCode,
                    typeLabel: session.typeLabel,
                    teacherName: session.teacherName,
                    link: session.link,
                    backupClassroomUrl: session.backupClassroomUrl,
                    date,
                    startTime,
                    endTime,
                    startAt,
                    endAt,
                    status: sessionStatus(startAt, endAt, now),
                } satisfies FlattenedLiveSession;
            }),
        )
        .sort((left, right) => {
            const leftEnded = left.status === 'ended';
            const rightEnded = right.status === 'ended';

            if (leftEnded !== rightEnded) {
                return leftEnded ? 1 : -1;
            }

            if (left.startAt && right.startAt) {
                return left.startAt.getTime() - right.startAt.getTime();
            }

            return `${left.date}${left.startTime}`.localeCompare(
                `${right.date}${right.startTime}`,
            );
        });
}

export function resolveTimeZone(
    displayTimezone: DisplayTimezone,
    systemTimeZone: string,
): string {
    return displayTimezone === 'taiwan' ? TAIWAN_TIME_ZONE : systemTimeZone;
}

export function formatMonthDay(
    date: Date | null,
    fallbackDate: string,
    timeZone: string,
): string {
    if (!date) {
        return fallbackDate;
    }

    return new Intl.DateTimeFormat('zh-TW', {
        timeZone,
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

export function formatWeekday(date: Date | null, timeZone: string): string {
    if (!date) {
        return '';
    }

    return new Intl.DateTimeFormat('zh-TW', {
        timeZone,
        weekday: 'short',
    }).format(date);
}

export function formatSessionClock(
    date: Date | null,
    fallbackTime: string,
    fallbackDate: string,
    options: { displayTimezone: DisplayTimezone; timeZone: string },
): string {
    if (!date) {
        return fallbackTime.slice(0, 5);
    }

    const { displayTimezone, timeZone } = options;
    const shouldShowDate =
        displayTimezone === 'local' &&
        timeZone !== TAIWAN_TIME_ZONE &&
        new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(date) !== fallbackDate;

    const timeLabel = new Intl.DateTimeFormat('zh-TW', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);

    if (!shouldShowDate) {
        return timeLabel;
    }

    return `${formatMonthDay(date, fallbackDate, timeZone)} ${timeLabel}`;
}

export function groupSessionsByMonth(
    sessions: readonly FlattenedLiveSession[],
    timeZone: string,
): Array<MonthBlock<FlattenedLiveSession>> {
    const groups = new Map<string, MonthBlock<FlattenedLiveSession>>();

    for (const session of sessions) {
        const { startAt, date } = session;
        const monthKey = startAt
            ? new Intl.DateTimeFormat('en-CA', {
                  timeZone,
                  year: 'numeric',
                  month: '2-digit',
              }).format(startAt)
            : date;
        const monthLabel = startAt
            ? new Intl.DateTimeFormat('zh-TW', {
                  timeZone,
                  year: 'numeric',
                  month: 'long',
              }).format(startAt)
            : date;
        const block = groups.get(monthKey);

        if (block) {
            block.items.push(session);
        } else {
            groups.set(monthKey, { monthLabel, monthKey, items: [session] });
        }
    }

    return Array.from(groups.values());
}

export function formatUtcOffset(totalMinutes: number): string {
    const sign = totalMinutes >= 0 ? '+' : '-';
    const absoluteMinutes = Math.abs(totalMinutes);
    const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0');
    const minutes = String(absoluteMinutes % 60).padStart(2, '0');

    return `UTC${sign}${hours}:${minutes}`;
}

/** Teacher name split so "老師" can be rendered smaller. */
export function splitTeacherName(teacherName: string | null): {
    name: string;
    hasTitle: boolean;
} {
    if (!teacherName) {
        return { name: '未提供', hasTitle: false };
    }

    return teacherName.endsWith('老師')
        ? { name: teacherName.replace(/老師$/, ''), hasTitle: true }
        : { name: teacherName, hasTitle: false };
}
