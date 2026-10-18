import { isRecord } from '../../http/encoding';

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
    const parsed = Number.parseFloat(value.trimStart());

    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }

  return Array.isArray(value) && value.length > 0 ? 1 : 0;
}

/** PHP `(string)` cast for scalars (null becomes ''). */
export function phpString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '';
  }

  return String(value);
}

/** PHP `isset($array[$key])`: present and not null. */
export function isSet(record: Record<string, unknown>, key: string): boolean {
  return record[key] !== undefined && record[key] !== null;
}

/** PHP 8.1+ `htmlspecialchars` with its default flags. */
export function htmlSpecialChars(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/** PHP `nl2br`: inserts `<br />` before every newline sequence. */
export function nl2br(value: string): string {
  return value.replace(/\r\n|\n\r|\n|\r/g, (newline) => `<br />${newline}`);
}

/**
 * Laravel's TrimStrings + ConvertEmptyStringsToNull request middleware,
 * which the legacy controllers ran behind for every input value.
 */
export function normalizeInput(value: unknown): string | null {
  if (typeof value !== 'string') {
    return value === null || value === undefined ? null : String(value);
  }

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
}
