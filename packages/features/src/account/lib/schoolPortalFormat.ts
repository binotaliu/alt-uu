const TIME_RANGE_PATTERN = /^(\d{2})(\d{2})~(\d{2})(\d{2})(?:第(\d+)節)?$/;

const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function toChineseOrdinal(value: number): string {
    if (value < 10) {
        return DIGITS[value]!;
    }

    if (value < 20) {
        return `十${value % 10 === 0 ? '' : DIGITS[value % 10]}`;
    }

    const ones = value % 10;

    return `${DIGITS[Math.floor(value / 10)]}十${ones === 0 ? '' : DIGITS[ones]}`;
}

/**
 * School portal times come as "1500~1610第5節" or plain "1900~2050";
 * reformat into "第五節 – 15:00~16:10" / "19:00~20:50".
 */
export function formatSchoolPortalTimeRange(raw: string | null): string | null {
    if (!raw) {
        return null;
    }

    const match = raw.match(TIME_RANGE_PATTERN);

    if (!match) {
        return raw;
    }

    const [, startHour, startMinute, endHour, endMinute, period] = match;
    const range = `${startHour}:${startMinute}~${endHour}:${endMinute}`;

    return period
        ? `第${toChineseOrdinal(Number(period))}節 – ${range}`
        : range;
}
