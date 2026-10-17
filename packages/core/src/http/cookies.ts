/**
 * Explicit, per-session cookie jar: a plain `name → value` map, exactly the
 * shape the legacy PHP clients kept in `session.cookies`. There is no domain
 * or path matching: each jar belongs to one service session (HUNGU or the
 * school portal) and is sent whole with every request to that service.
 */
export type CookieJar = Record<string, string>;

export interface ParsedSetCookie {
    name: string;
    value: string;
    /** True when Max-Age <= 0 or Expires lies in the past. */
    expired: boolean;
}

const MONTHS = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
];

/**
 * Parses one Set-Cookie header. The name/value split matches the legacy
 * `extractSetCookies` (first `;`-delimited pair, split on the first `=`,
 * both trimmed). Headers without `=` in the first pair are ignored.
 */
export function parseSetCookie(
    header: string,
    now: Date = new Date(),
): ParsedSetCookie | null {
    const [firstPair, ...attributeParts] = header.split(';');

    if (firstPair === undefined || !firstPair.includes('=')) {
        return null;
    }

    const separator = firstPair.indexOf('=');
    const name = firstPair.slice(0, separator).trim();
    const value = firstPair.slice(separator + 1).trim();

    let expired = false;
    let maxAgeSeen = false;

    for (const part of attributeParts) {
        const attributeSeparator = part.indexOf('=');
        const attributeName = (
            attributeSeparator === -1 ? part : part.slice(0, attributeSeparator)
        )
            .trim()
            .toLowerCase();
        const attributeValue =
            attributeSeparator === -1
                ? ''
                : part.slice(attributeSeparator + 1).trim();

        if (attributeName === 'max-age' && /^-?\d+$/.test(attributeValue)) {
            // Max-Age wins over Expires (RFC 6265 §5.3 step 3).
            maxAgeSeen = true;
            expired = Number(attributeValue) <= 0;
        } else if (attributeName === 'expires' && !maxAgeSeen) {
            const expiresAt = parseCookieDate(attributeValue);

            if (expiresAt !== null) {
                expired = expiresAt.getTime() <= now.getTime();
            }
        }
    }

    return { name, value, expired };
}

/**
 * Merges Set-Cookie headers into a copy of `jar`. Expired cookies are removed
 * (the legacy PHP code stored `name=deleted` verbatim; the native cookie
 * stores this replaces did delete them, so we follow RFC 6265 here).
 */
export function applySetCookies(
    jar: CookieJar,
    setCookieHeaders: readonly string[],
    now: Date = new Date(),
): CookieJar {
    const merged: CookieJar = { ...jar };

    for (const header of setCookieHeaders) {
        const parsed = parseSetCookie(header, now);

        if (parsed === null) {
            continue;
        }

        if (parsed.expired) {
            delete merged[parsed.name];
        } else {
            merged[parsed.name] = parsed.value;
        }
    }

    return merged;
}

/** Later sources win, like the legacy `mergeCookies(...$sources)`. */
export function mergeCookies(...sources: CookieJar[]): CookieJar {
    return Object.assign({}, ...sources) as CookieJar;
}

/** `a=1; b=2`, like the legacy `cookieHeader()` (no encoding). */
export function cookieHeader(jar: CookieJar): string {
    return Object.entries(jar)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
}

/**
 * Splits a header value in which several Set-Cookie headers were folded
 * into one with commas (iOS `allHeaderFields` and RN's XHR do this). A comma
 * only starts a new cookie when it is followed by `name=`; the comma inside
 * `Expires=Thu, 01 Jan 1970 ...` is followed by a space and a digit.
 */
export function splitSetCookieHeader(value: string): string[] {
    return value
        .split(/,(?=\s*[^;,=\s]+=)/)
        .map((part) => part.trim())
        .filter((part) => part !== '');
}

/** RFC 6265 §5.1.1 cookie-date parser (tolerates `01-Jan-1970`). */
export function parseCookieDate(input: string): Date | null {
    // RFC 6265 delimiters include TAB.
    // eslint-disable-next-line no-control-regex
    const tokens = input.split(/[\x09\x20-\x2f\x3b-\x40\x5b-\x60\x7b-\x7e]+/);
    let time: [number, number, number] | null = null;
    let day: number | null = null;
    let month: number | null = null;
    let year: number | null = null;

    for (const token of tokens) {
        if (token === '') {
            continue;
        }

        const timeMatch: RegExpExecArray | null =
            time === null ? /^(\d{1,2}):(\d{1,2}):(\d{1,2})/.exec(token) : null;

        if (timeMatch !== null) {
            time = [
                Number(timeMatch[1]),
                Number(timeMatch[2]),
                Number(timeMatch[3]),
            ];
            continue;
        }

        if (day === null && /^\d{1,2}(?!\d)/.test(token)) {
            day = Number(/^\d{1,2}/.exec(token)?.[0]);
            continue;
        }

        const monthIndex: number =
            month === null
                ? MONTHS.indexOf(token.slice(0, 3).toLowerCase())
                : -1;

        if (monthIndex !== -1) {
            month = monthIndex;
            continue;
        }

        if (year === null && /^\d{2,4}(?!\d)/.test(token)) {
            year = Number(/^\d{2,4}/.exec(token)?.[0]);
        }
    }

    if (time === null || day === null || month === null || year === null) {
        return null;
    }

    if (year >= 70 && year <= 99) {
        year += 1900;
    } else if (year >= 0 && year <= 69) {
        year += 2000;
    }

    if (
        day < 1 ||
        day > 31 ||
        year < 1601 ||
        time[0] > 23 ||
        time[1] > 59 ||
        time[2] > 59
    ) {
        return null;
    }

    return new Date(Date.UTC(year, month, day, time[0], time[1], time[2]));
}
