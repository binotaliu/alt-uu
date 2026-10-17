/** Port of the legacy CourseNameMatcher (only what nou-tools matching needs). */

/** NFKC, lower-cased, with all separators, punctuation and symbols removed. */
export function normalizeCourseName(name: string): string {
    const trimmed = name.trim();

    if (trimmed === '') {
        return '';
    }

    const normalized = trimmed.normalize('NFKC');
    const value = normalized !== '' ? normalized : trimmed;

    return value
        .toLowerCase()
        .replace(/[\p{Z}\p{P}\p{S}]+/gu, '')
        .trim();
}

const SEASON_CODES: Record<string, string> = { 上: 'A', 下: 'B', 暑: 'C' };

/**
 * Canonical term code (`114上` or `114學年上學期` or `114上學期` become `2025A`),
 * or null when the semester label is not recognised.
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

    const match =
        /^(?<year>\d{2,3})(?<season>[上下暑])$/u.exec(normalized) ??
        /^(?<year>\d{2,3})學年(?:(?<season>[上下])學期|(?<season2>暑)期)$/u.exec(
            normalized,
        ) ??
        /^(?<year>\d{2,3})(?:(?<season>[上下])學期|(?<season2>暑)期)$/u.exec(
            normalized,
        );

    if (match?.groups === undefined) {
        return null;
    }

    const rocYear = Number.parseInt(match.groups.year, 10);
    const season = match.groups.season ?? match.groups.season2;
    const seasonCode = season === undefined ? undefined : SEASON_CODES[season];

    if (rocYear <= 0 || seasonCode === undefined) {
        return null;
    }

    return `${rocYear + 1911}${seasonCode}`;
}
