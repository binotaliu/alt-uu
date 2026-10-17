/**
 * Port of legacy CourseNameMatcher. Kept local to this domain because the
 * domains are developed independently; behaviour must stay identical.
 */
export function normalizeCourseName(name: string): string {
    const value = name.trim();

    if (value === '') {
        return '';
    }

    return value
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\p{Z}\p{P}\p{S}]+/gu, '')
        .trim();
}

const SEASON_CODES: Record<string, string> = { 上: 'A', 下: 'B', 暑: 'C' };

/**
 * Normalizes "114下", "114學年下學期", "114上學期", "115暑期" etc. to a term
 * code such as "2025B"; null when unrecognized.
 */
export function normalizeTermCode(
    semester: string | null | undefined,
): string | null {
    if (typeof semester !== 'string') {
        return null;
    }

    const normalized = semester.trim().replace(/\s+/gu, '');

    if (normalized === '') {
        return null;
    }

    let year: string | undefined;
    let season: string | undefined;
    let match: RegExpMatchArray | null;

    if ((match = normalized.match(/^(\d{2,3})(上|下|暑)$/u)) !== null) {
        [, year, season] = match;
    } else if (
        (match = normalized.match(/^(\d{2,3})學年(?:(上|下)學期|(暑)期)$/u)) !==
        null
    ) {
        year = match[1];
        season = match[2] ?? match[3];
    } else if (
        (match = normalized.match(/^(\d{2,3})(?:(上|下)學期|(暑)期)$/u)) !==
        null
    ) {
        year = match[1];
        season = match[2] ?? match[3];
    }

    if (year === undefined || season === undefined) {
        return null;
    }

    const rocYear = Number.parseInt(year, 10);
    const seasonCode = SEASON_CODES[season];

    if (rocYear <= 0 || seasonCode === undefined) {
        return null;
    }

    return `${rocYear + 1911}${seasonCode}`;
}
