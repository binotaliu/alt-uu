/**
 * PHP `version_compare` for the version strings the status feed carries.
 * Returns -1, 0 or 1.
 */
export function versionCompare(left: string, right: string): -1 | 0 | 1 {
    const a = canonicalizeVersion(left);
    const b = canonicalizeVersion(right);
    const common = Math.min(a.length, b.length);

    for (let index = 0; index < common; index += 1) {
        const result = comparePart(a[index], b[index]);

        if (result !== 0) {
            return result;
        }
    }

    if (a.length > common) {
        return isDigits(a[common]) ? 1 : comparePart(a[common], '#');
    }

    if (b.length > common) {
        return isDigits(b[common]) ? -1 : comparePart('#', b[common]);
    }

    return 0;
}

const FORM_ORDER: Array<[string, number]> = [
    ['dev', 0],
    ['alpha', 1],
    ['a', 1],
    ['beta', 2],
    ['b', 2],
    ['RC', 3],
    ['rc', 3],
    ['#', 4],
    ['pl', 5],
    ['p', 5],
];

function canonicalizeVersion(version: string): string[] {
    return version
        .replace(/[-_+]/g, '.')
        .replace(/(\d)([^\d.])/g, '$1.$2')
        .replace(/([^\d.])(\d)/g, '$1.$2')
        .split('.')
        .filter((part) => part !== '');
}

function isDigits(part: string): boolean {
    return /^\d+$/.test(part);
}

function formOrder(part: string): number {
    const found = FORM_ORDER.find(([name]) => part.startsWith(name));

    return found === undefined ? -7 : found[1];
}

function comparePart(left: string, right: string): -1 | 0 | 1 {
    let a: number;
    let b: number;

    if (isDigits(left) && isDigits(right)) {
        a = Number.parseInt(left, 10);
        b = Number.parseInt(right, 10);
    } else if (!isDigits(left) && !isDigits(right)) {
        a = formOrder(left);
        b = formOrder(right);
    } else if (isDigits(left)) {
        a = formOrder('#');
        b = formOrder(right);
    } else {
        a = formOrder(left);
        b = formOrder('#');
    }

    return a === b ? 0 : a < b ? -1 : 1;
}

/** Whether the code point takes two columns in PHP's `mb_strwidth`. */
function isWide(codePoint: number): boolean {
    return (
        (codePoint >= 0x1100 && codePoint <= 0x115f) ||
        (codePoint >= 0x2e80 && codePoint <= 0x303e) ||
        (codePoint >= 0x3041 && codePoint <= 0x33ff) ||
        (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
        (codePoint >= 0x4e00 && codePoint <= 0xa4c6) ||
        (codePoint >= 0xa960 && codePoint <= 0xa97c) ||
        (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
        (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
        (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
        (codePoint >= 0xfe30 && codePoint <= 0xfe6b) ||
        (codePoint >= 0xff01 && codePoint <= 0xff60) ||
        (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
        (codePoint >= 0x1f200 && codePoint <= 0x1f251) ||
        (codePoint >= 0x20000 && codePoint <= 0x3fffd)
    );
}

/**
 * Laravel `Str::limit($value, $limit)`: width-based like `mb_strimwidth`, so
 * a CJK character counts as two columns.
 */
export function limitByWidth(value: string, limit: number): string {
    const characters = [...value];
    const widths = characters.map((character) =>
        isWide(character.codePointAt(0) ?? 0) ? 2 : 1,
    );

    if (widths.reduce((sum, width) => sum + width, 0) <= limit) {
        return value;
    }

    let used = 0;
    let kept = '';

    for (const [index, character] of characters.entries()) {
        if (used + widths[index] > limit) {
            break;
        }

        used += widths[index];
        kept += character;
    }

    return `${kept.trimEnd()}...`;
}
