/**
 * PHP URL helpers (`parse_url`, `basename`, `pathinfo`, `parse_str`) with
 * PHP's lenient semantics. React Native's `URL` is incomplete and WHATWG
 * parsing normalises paths, which the legacy code did not.
 */

export interface PhpUrlParts {
    scheme?: string;
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    path?: string;
    query?: string;
    fragment?: string;
}

const URL_PATTERN =
    /^(?:([a-zA-Z][a-zA-Z0-9+.-]*):)?(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#([\s\S]*))?$/;

/** `parse_url($url)`; null where PHP returns false. */
export function parseUrl(url: string): PhpUrlParts | null {
    const match = URL_PATTERN.exec(url);

    if (match === null) {
        return null;
    }

    const [, scheme, authority, path, query, fragment] = match;
    const parts: PhpUrlParts = {};

    if (scheme !== undefined) {
        parts.scheme = scheme;
    }

    if (authority !== undefined) {
        let hostPort = authority;
        const at = authority.lastIndexOf('@');

        if (at >= 0) {
            const userInfo = authority.slice(0, at);
            hostPort = authority.slice(at + 1);
            const colon = userInfo.indexOf(':');
            parts.user = colon >= 0 ? userInfo.slice(0, colon) : userInfo;

            if (colon >= 0) {
                parts.pass = userInfo.slice(colon + 1);
            }
        }

        const portMatch = /^(.*?)(?::(\d*))?$/.exec(hostPort);
        const host = portMatch?.[1] ?? hostPort;

        if (portMatch?.[2] !== undefined && portMatch[2] !== '') {
            const port = Number.parseInt(portMatch[2], 10);

            if (port > 65535) {
                return null;
            }

            parts.port = port;
        }

        if (host !== '') {
            parts.host = host;
        } else if (scheme !== undefined && scheme.toLowerCase() !== 'file') {
            return null;
        }
    }

    if (path !== '') {
        parts.path = path;
    }

    if (query !== undefined) {
        parts.query = query;
    }

    if (fragment !== undefined) {
        parts.fragment = fragment;
    }

    return parts;
}

export function urlHost(url: string): string | null {
    return parseUrl(url)?.host ?? null;
}

export function urlPath(url: string): string {
    return parseUrl(url)?.path ?? '';
}

/** PHP `basename()` for `/`-separated paths. */
export function phpBasename(path: string): string {
    const trimmed = path.replace(/\/+$/, '');

    return trimmed.slice(trimmed.lastIndexOf('/') + 1);
}

/** `pathinfo($path, PATHINFO_EXTENSION)`. */
export function phpExtension(path: string): string {
    const base = phpBasename(path);
    const dot = base.lastIndexOf('.');

    return dot >= 0 ? base.slice(dot + 1) : '';
}

/** One scalar value of `parse_str($query)`, or null. */
export function queryParam(query: string, name: string): string | null {
    let value: string | null = null;

    for (const pair of query.split('&')) {
        if (pair === '') {
            continue;
        }

        const eq = pair.indexOf('=');
        const key = decodeQueryComponent(eq >= 0 ? pair.slice(0, eq) : pair);

        if (key === name) {
            value = decodeQueryComponent(eq >= 0 ? pair.slice(eq + 1) : '');
        }
    }

    return value;
}

function decodeQueryComponent(value: string): string {
    const plus = value.replace(/\+/g, ' ');

    try {
        return decodeURIComponent(plus);
    } catch {
        return plus.replace(/%([0-9a-f]{2})/gi, (_, hex: string) =>
            String.fromCharCode(Number.parseInt(hex, 16)),
        );
    }
}

/** PHP `trim()` default character set. */
export function phpTrim(value: string): string {
    return value.replace(/^[ \t\n\r\0\v]+|[ \t\n\r\0\v]+$/g, '');
}

/** Drops `.`/empty segments and resolves `..` (legacy normalizePath). */
export function normalizePath(path: string): string {
    const normalized: string[] = [];

    for (const segment of path.split('/')) {
        if (segment === '' || segment === '.') {
            continue;
        }

        if (segment === '..') {
            normalized.pop();
            continue;
        }

        normalized.push(segment);
    }

    return `/${normalized.join('/')}`;
}

/** Port of ParseMaterialContent::resolveRelativeUrl. */
export function resolveRelativeUrl(
    base: string,
    rawRelative: string,
): string | null {
    const relative = phpTrim(rawRelative);

    if (relative === '') {
        return null;
    }

    if (relative.startsWith('http://') || relative.startsWith('https://')) {
        return relative;
    }

    const parsed = parseUrl(base);

    if (parsed === null) {
        return null;
    }

    const scheme = parsed.scheme ?? 'https';
    const host = parsed.host ?? '';

    if (host === '') {
        return null;
    }

    const port = parsed.port !== undefined ? `:${parsed.port}` : '';

    if (relative.startsWith('//')) {
        return `${scheme}:${relative}`;
    }

    if (relative.startsWith('#') || relative.startsWith('?')) {
        return `${scheme}://${host}${port}${normalizePath(parsed.path ?? '/')}${relative}`;
    }

    const relativeParts = parseUrl(relative);

    if (relativeParts === null) {
        return null;
    }

    const relativePath = relativeParts.path ?? '';
    const basePath = parsed.path ?? '/';
    const path = relativePath.startsWith('/')
        ? relativePath
        : `${basePath.replace(/\/[^/]*$/, '/')}${relativePath}`;
    const query =
        relativeParts.query !== undefined ? `?${relativeParts.query}` : '';
    const fragment =
        relativeParts.fragment !== undefined
            ? `#${relativeParts.fragment}`
            : '';

    return `${scheme}://${host}${port}${normalizePath(path)}${query}${fragment}`;
}
