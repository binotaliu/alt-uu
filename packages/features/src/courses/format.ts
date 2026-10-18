import type { CourseItem, CourseTasksCount } from '@altuu/core';

const SCHOOL_PORTAL_TIME_RANGE_PATTERN =
    /^(\d{2})(\d{2})~(\d{2})(\d{2})(?:第(\d+)節)?$/;

const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function toChineseOrdinal(value: number): string {
    if (value < 10) {
        return DIGITS[value];
    }

    if (value < 20) {
        return `十${value % 10 === 0 ? '' : DIGITS[value % 10]}`;
    }

    const tens = Math.floor(value / 10);
    const ones = value % 10;

    return `${DIGITS[tens]}十${ones === 0 ? '' : DIGITS[ones]}`;
}

/**
 * School portal times come as "1500~1610第5節" or plain "1900~2050";
 * reformat into "第五節 – 15:00~16:10" / "19:00~20:50".
 */
export function formatSchoolPortalTimeRange(raw: string | null): string | null {
    if (!raw) {
        return null;
    }

    const match = raw.match(SCHOOL_PORTAL_TIME_RANGE_PATTERN);

    if (!match) {
        return raw;
    }

    const [, startHour, startMinute, endHour, endMinute, period] = match;
    const range = `${startHour}:${startMinute}~${endHour}:${endMinute}`;

    return period
        ? `第${toChineseOrdinal(Number(period))}節 – ${range}`
        : range;
}

/** "第1次 2026/09/22 第2次 2026/10/20" split into one entry per line. */
export function formatSchoolPortalClassDates(raw: string | null): string[] {
    if (!raw) {
        return [];
    }

    const entries = raw.match(/第\d+次\s*\S+/g);

    return entries && entries.length > 0 ? entries : [raw];
}

/** 99+ badge text. */
export function formatBadgeCount(count: number): string {
    return count > 99 ? '99+' : String(count);
}

const emptyTasks = (courseId: string): CourseTasksCount => ({
    courseId,
    pendingHomeworks: 0,
    unreadArticles: 0,
});

/**
 * Pending / unread counts of a course, summed with its shared course
 * (`commonCourseId`) like the legacy list and show pages did.
 */
export function courseTasksFor(
    course: Pick<CourseItem, 'courseId' | 'commonCourseId'>,
    counts: Readonly<Record<string, CourseTasksCount>>,
): CourseTasksCount {
    const primary = counts[course.courseId] ?? emptyTasks(course.courseId);
    const common = course.commonCourseId
        ? (counts[course.commonCourseId] ?? emptyTasks(course.commonCourseId))
        : emptyTasks(course.courseId);

    return {
        courseId: course.courseId,
        pendingHomeworks: primary.pendingHomeworks + common.pendingHomeworks,
        unreadArticles: primary.unreadArticles + common.unreadArticles,
    };
}

export function indexTasksCount(
    list: readonly CourseTasksCount[],
): Record<string, CourseTasksCount> {
    return Object.fromEntries(list.map((item) => [item.courseId, item]));
}

/** Groups courses by trimmed semester ('其他' when blank), keeping order. */
export function groupCoursesBySemester(
    courses: readonly CourseItem[],
): Array<{ semester: string; courses: CourseItem[] }> {
    const groups = new Map<string, CourseItem[]>();

    for (const course of courses) {
        const key = course.semester ? course.semester.trim() : '其他';
        const bucket = groups.get(key);

        if (bucket) {
            bucket.push(course);
        } else {
            groups.set(key, [course]);
        }
    }

    return Array.from(groups, ([semester, items]) => ({
        semester,
        courses: items,
    }));
}

/** `mm:ss` / `h:mm:ss` clock used for the "上次看到" label. */
export function formatClock(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = String(safeSeconds % 60).padStart(2, '0');

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`;
    }

    return `${minutes}:${seconds}`;
}
