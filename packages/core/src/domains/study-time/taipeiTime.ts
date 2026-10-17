const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

/** `Y-m-d` of the instant in Asia/Taipei (UTC+8, no DST). */
export function taipeiDateString(date: Date): string {
    return new Date(date.getTime() + TAIPEI_OFFSET_MS)
        .toISOString()
        .slice(0, 10);
}

/** `Y-m-d H:i:s` of the instant in Asia/Taipei. */
export function formatTaipeiDateTime(date: Date): string {
    const shifted = new Date(date.getTime() + TAIPEI_OFFSET_MS);

    return (
        `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ` +
        `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`
    );
}

/** Parses `Y-m-d H:i:s` as an Asia/Taipei wall-clock time; null when malformed. */
export function parseTaipeiDateTime(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(
        value,
    );

    if (match === null) {
        return null;
    }

    const [year, month, day, hour, minute, second] = match.slice(1).map(Number);

    return new Date(
        Date.UTC(year, month - 1, day, hour, minute, second) - TAIPEI_OFFSET_MS,
    );
}
