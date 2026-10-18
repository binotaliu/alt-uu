/**
 * PHP-compatible encoders, so request URLs and bodies stay byte-identical to
 * what the legacy Laravel clients sent.
 */

/** PHP `rawurlencode` (RFC 3986). */
export function rawUrlEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** PHP `urlencode` (RFC 1738: space → `+`, `~` encoded). */
export function urlEncode(value: string): string {
  return rawUrlEncode(value).replace(/%20/g, '+').replace(/~/g, '%7E');
}

export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | QueryValue[]
  | { [key: string]: QueryValue };

/**
 * PHP `http_build_query($data)` with its default RFC 1738 encoding: nulls
 * are skipped, booleans become `1`/`0`, nested arrays use `key[sub]`.
 */
export function httpBuildQuery(data: Record<string, QueryValue>): string {
  const pairs: string[] = [];

  const append = (key: string, value: QueryValue): void => {
    if (value === null || value === undefined) {
      return;
    }

    if (typeof value === 'object') {
      const entries = Array.isArray(value)
        ? value.map((item, index) => [String(index), item] as const)
        : Object.entries(value);

      for (const [subKey, subValue] of entries) {
        append(`${key}[${subKey}]`, subValue);
      }

      return;
    }

    const scalar =
      typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
    pairs.push(`${urlEncode(key)}=${urlEncode(scalar)}`);
  };

  for (const [key, value] of Object.entries(data)) {
    append(key, value);
  }

  return pairs.join('&');
}

/**
 * PHP `json_encode($value)` with default flags: `/` is escaped as `\/` and
 * every non-ASCII code unit as a lowercase `\uXXXX` escape.
 */
export function phpJsonEncode(value: unknown): string {
  const json = JSON.stringify(value);

  if (json === undefined) {
    return 'null';
  }

  return json.replace(/[/\u0080-\uffff]/g, (char) =>
    char === '/'
      ? '\\/'
      : `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

/** Decodes the HTML character references that appear in attribute values. */
export function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity[0] === '#') {
        const codePoint =
          entity[1] === 'x' || entity[1] === 'X'
            ? Number.parseInt(entity.slice(2), 16)
            : Number.parseInt(entity.slice(1), 10);

        return Number.isFinite(codePoint) && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : match;
      }

      return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    },
  );
}

/**
 * PHP `$response->json()`: the decoded body, or null when it is empty or not
 * valid JSON.
 */
export function decodeJson(body: string): unknown {
  if (body.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Laravel `Arr::get($array, 'a.b.c')` for decoded JSON. */
export function dataGet(value: unknown, path: string): unknown {
  let current: unknown = value;

  for (const segment of path.split('.')) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}
