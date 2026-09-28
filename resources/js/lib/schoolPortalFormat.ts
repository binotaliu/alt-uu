// School portal times come as "1500~1610第5節" or plain "1900~2050" — reformat
// into "第五節 – 15:00~16:10" / "19:00~20:50" for readability.
const SCHOOL_PORTAL_TIME_RANGE_PATTERN =
    /^(\d{2})(\d{2})~(\d{2})(\d{2})(?:第(\d+)節)?$/;

function toChineseOrdinal(value: number): string {
    const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

    if (value < 10) {
        return digits[value];
    }

    if (value < 20) {
        return `十${value % 10 === 0 ? '' : digits[value % 10]}`;
    }

    const tens = Math.floor(value / 10);
    const ones = value % 10;

    return `${digits[tens]}十${ones === 0 ? '' : digits[ones]}`;
}

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

// classDates comes as a single space-joined string, e.g.
// "第1次 2026/09/22 第2次 2026/10/20" — split it back into one entry per line.
export function formatSchoolPortalClassDates(raw: string | null): string[] {
    if (!raw) {
        return [];
    }

    const entries = raw.match(/第\d+次\s*\S+/g);

    return entries && entries.length > 0 ? entries : [raw];
}
