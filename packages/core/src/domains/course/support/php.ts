import { isRecord } from '../../../http/encoding';

/** PHP `(bool)` cast for decoded JSON values. */
export function phpBool(value: unknown): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    if (typeof value === 'string') {
        return value !== '' && value !== '0';
    }

    if (Array.isArray(value)) {
        return value.length > 0;
    }

    if (isRecord(value)) {
        return Object.keys(value).length > 0;
    }

    return true;
}

/** PHP `(int)` cast for decoded JSON values. */
export function phpInt(value: unknown): number {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? Math.trunc(value) : 0;
    }

    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }

    if (typeof value === 'string') {
        const match =
            /^[ \t\n\r\v\f]*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(
                value,
            );

        return match === null ? 0 : Math.trunc(Number.parseFloat(match[0]));
    }

    if (Array.isArray(value)) {
        return value.length > 0 ? 1 : 0;
    }

    return isRecord(value) && Object.keys(value).length > 0 ? 1 : 0;
}

/** PHP `(string)` cast for scalars (null becomes ''). */
export function phpString(value: unknown): string {
    if (value === null || value === undefined || value === false) {
        return '';
    }

    if (value === true) {
        return '1';
    }

    if (typeof value === 'object') {
        return 'Array';
    }

    return String(value);
}

/** PHP `is_scalar()`. */
export function isScalar(value: unknown): value is string | number | boolean {
    return (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    );
}

/** `foreach` over a decoded PHP array (list or associative). */
export function phpValues(value: unknown): unknown[] {
    if (Array.isArray(value)) {
        return value;
    }

    return isRecord(value) ? Object.values(value) : [];
}

/** PHP `empty()` for a decoded array. */
export function isEmptyArray(value: unknown): boolean {
    return phpValues(value).length === 0;
}

/** PHP `$value ?: null` for strings ('' and '0' are falsy). */
export function phpTruthyOrNull(value: string): string | null {
    return value === '' || value === '0' ? null : value;
}
