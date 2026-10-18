import { CP950_TABLE, CP950_TRAIL_COUNT } from './cp950Table.generated';

/**
 * Port of the legacy `ensureUtf8()` helper: upstream pages are usually
 * UTF-8, but some HUNGU materials are Big5 served with a (wrong) UTF-8
 * charset, and a few contain stray Latin-1 bytes. PHP tried, in order:
 * valid UTF-8 → Big5 / CP950 (`mb_detect_encoding` strict) → Windows-1252.
 */
export function decodeLegacyText(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return '';
  }

  const utf8 = decodeUtf8Strict(bytes);

  if (utf8 !== null) {
    return utf8;
  }

  return decodeCp950Strict(bytes) ?? decodeWindows1252(bytes);
}

/**
 * Bytes → string, or null when the input is not valid UTF-8. Hand-written
 * because Hermes' TextDecoder does not support `fatal`.
 */
export function decodeUtf8Strict(bytes: Uint8Array): string | null {
  const codeUnits: number[] = [];
  let result = '';
  let index = 0;

  while (index < bytes.length) {
    const first = bytes[index];
    let codePoint: number;
    let length: number;

    if (first < 0x80) {
      codePoint = first;
      length = 1;
    } else if (first >= 0xc2 && first <= 0xdf) {
      codePoint = first & 0x1f;
      length = 2;
    } else if (first >= 0xe0 && first <= 0xef) {
      codePoint = first & 0x0f;
      length = 3;
    } else if (first >= 0xf0 && first <= 0xf4) {
      codePoint = first & 0x07;
      length = 4;
    } else {
      return null;
    }

    if (index + length > bytes.length) {
      return null;
    }

    for (let offset = 1; offset < length; offset++) {
      const next = bytes[index + offset];

      if ((next & 0xc0) !== 0x80) {
        return null;
      }

      codePoint = (codePoint << 6) | (next & 0x3f);
    }

    if (
      (length === 3 &&
        (codePoint < 0x800 || (codePoint >= 0xd800 && codePoint <= 0xdfff))) ||
      (length === 4 && (codePoint < 0x10000 || codePoint > 0x10ffff))
    ) {
      return null;
    }

    if (codePoint > 0xffff) {
      const offset = codePoint - 0x10000;
      codeUnits.push(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff));
    } else {
      codeUnits.push(codePoint);
    }

    if (codeUnits.length >= 0x4000) {
      result += String.fromCharCode(...codeUnits);
      codeUnits.length = 0;
    }

    index += length;
  }

  return result + String.fromCharCode(...codeUnits);
}

/** Big5 (CP950) bytes → string, or null when any sequence is invalid. */
export function decodeCp950Strict(bytes: Uint8Array): string | null {
  let result = '';

  for (let index = 0; index < bytes.length; index++) {
    const lead = bytes[index];

    if (lead < 0x80) {
      result += String.fromCharCode(lead);
      continue;
    }

    const trail = bytes[index + 1];

    if (lead < 0x81 || lead > 0xfe || trail === undefined) {
      return null;
    }

    const trailIndex =
      trail >= 0x40 && trail <= 0x7e
        ? trail - 0x40
        : trail >= 0xa1 && trail <= 0xfe
          ? trail - 0xa1 + 0x3f
          : -1;

    if (trailIndex < 0) {
      return null;
    }

    const char = CP950_TABLE[(lead - 0x81) * CP950_TRAIL_COUNT + trailIndex];

    if (char === undefined || char === '\ufffd') {
      return null;
    }

    result += char;
    index += 1;
  }

  return result;
}

/** 0x80–0x9F of Windows-1252; undefined bytes become `?` like mbstring. */
const WINDOWS_1252_HIGH = [
  '€',
  '?',
  '‚',
  'ƒ',
  '„',
  '…',
  '†',
  '‡',
  'ˆ',
  '‰',
  'Š',
  '‹',
  'Œ',
  '?',
  'Ž',
  '?',
  '?',
  '‘',
  '’',
  '“',
  '”',
  '•',
  '–',
  '—',
  '˜',
  '™',
  'š',
  '›',
  'œ',
  '?',
  'ž',
  'Ÿ',
];

export function decodeWindows1252(bytes: Uint8Array): string {
  let result = '';

  for (const byte of bytes) {
    result +=
      byte >= 0x80 && byte <= 0x9f
        ? WINDOWS_1252_HIGH[byte - 0x80]
        : String.fromCharCode(byte);
  }

  return result;
}

/**
 * A "binary string" (one char per byte, as produced by
 * {@link bytesToBinaryString}) back to bytes.
 */
export function binaryStringToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);

  for (let index = 0; index < value.length; index++) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }

  return bytes;
}

export function bytesToBinaryString(bytes: Uint8Array): string {
  let result = '';
  const chunk = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunk) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }

  return result;
}
