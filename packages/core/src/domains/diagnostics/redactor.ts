import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { phpTrim } from '../../hungu/uuCrypto';

export const REDACTED = '[已遮蔽]';

/**
 * Key fragments that mean "this value is a secret". Matched against a
 * normalized key (lowercased, separators stripped).
 */
const SECRET_KEY_FRAGMENTS = [
    'password',
    'passwd',
    'token',
    'secret',
    'cookie',
    'apikey',
    'receipt',
    'credential',
    'privatekey',
    'signature',
    'authorization',
];

/** Exact normalized keys that are secrets but too generic for fragments. */
const SECRET_KEYS = new Set([
    'ticket',
    'sessionidx',
    'sessionid',
    'signedpayload',
    'appkey',
    'anticsrf',
    'csrf',
    'ua',
    'auth',
    'pwd',
]);

/**
 * Exact normalized keys holding a personal identifier. Deliberately exact:
 * `accountId` is our own local primary key and must not be caught.
 */
const IDENTIFIER_KEYS = new Set([
    'username',
    'user',
    'userid',
    'studentid',
    'studentno',
    'stdno',
    'loginid',
    'displayname',
    'realname',
    'nickname',
    'name',
    'email',
    'mail',
]);

const SECRET_QUERY_PARAMS = new Set([
    'ticket',
    'ua',
    'username',
    'password',
    'token',
    'session_idx',
]);

const WS = ' \\t\\n\\r\\f\\v';
const ASSIGNMENT_PATTERN = new RegExp(
    `(["']?(?<key>[A-Za-z_][A-Za-z0-9_-]*)["']?[${WS}]*(?:=>|[:=])[${WS}]*)(["']?)(?<value>[^"'&,;}${WS}]+)(\\3)`,
    'g',
);
const QUERY_PARAMETER_PATTERN = new RegExp(
    `([?&;])(?<key>[A-Za-z0-9_\\-]+)=(?<value>[^&"'${WS}<>#]*)`,
    'g',
);
const HANDLE_PATTERN = /\bu\d{4,}\b/gi;
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/**
 * Port of legacy DiagnosticRedactor.
 *
 * Runs at WRITE time so the stored log never holds a credential. Secrets are
 * dropped; identifiers are pseudonymized to a stable per-install handle.
 */
export class DiagnosticRedactor {
    constructor(private readonly salt: string) {}

    /** Redact an arbitrary context value, recursively. */
    redact(context: Record<string, unknown>): Record<string, unknown>;
    redact(context: unknown[]): unknown[];
    redact(context: Record<string, unknown> | unknown[]): unknown {
        const entries: Array<[string, unknown]> = Array.isArray(context)
            ? context.map((value, index) => [String(index), value])
            : Object.entries(context);
        const result: Record<string, unknown> = {};

        for (const [key, value] of entries) {
            result[key] = this.redactEntry(key, value);
        }

        return Array.isArray(context) ? Object.values(result) : result;
    }

    /** Sweeps free text for anything that looks like a credential or id. */
    redactText(text: string): string {
        if (text === '') {
            return text;
        }

        let result = this.sweepQueryParameters(
            this.sweepAssignments(text, true),
        );

        result = result.replace(HANDLE_PATTERN, (match) =>
            this.pseudonymize(match),
        );

        return result.replace(EMAIL_PATTERN, (match) =>
            this.pseudonymize(match),
        );
    }

    /**
     * Drops credentials from free text but leaves everything else untouched
     * (for a page's HTML source). Identifiers are kept.
     */
    redactSecrets(text: string): string {
        if (text === '') {
            return text;
        }

        return this.sweepQueryParameters(this.sweepAssignments(text, false));
    }

    /** Strips credential query parameters, keeping scheme, host and path. */
    redactUrl(url: string): string {
        const parts = parseUrl(url);
        let rebuilt = '';

        if (parts.scheme !== undefined) {
            rebuilt += `${parts.scheme}://`;
        }

        if (parts.host !== undefined && parts.host !== '') {
            rebuilt += parts.host;

            if (parts.port !== undefined) {
                rebuilt += `:${parts.port}`;
            }
        }

        rebuilt += parts.path ?? '';

        if (parts.query !== undefined && parts.query !== '') {
            const query = parseQueryString(parts.query);
            const pairs: string[] = [];

            for (const [key, value] of query) {
                if (SECRET_QUERY_PARAMS.has(key.toLowerCase())) {
                    pairs.push(`${key}=${REDACTED}`);
                } else {
                    pairs.push(`${key}=${this.redactText(value)}`);
                }
            }

            if (pairs.length > 0) {
                rebuilt += `?${pairs.join('&')}`;
            }
        }

        return rebuilt === '' ? this.redactText(url) : rebuilt;
    }

    /**
     * Maps a personal identifier onto a stable, non-reversible handle:
     * stable within an install, different across installs.
     */
    pseudonymize(value: string): string {
        const normalized = phpTrim(value).toLowerCase();

        if (normalized === '') {
            return value;
        }

        const digest = bytesToHex(
            hmac(sha256, utf8ToBytes(this.salt), utf8ToBytes(normalized)),
        );

        return `user#${digest.slice(0, 4)}`;
    }

    private redactEntry(key: string, value: unknown): unknown {
        const normalized = normalizeKey(key);

        if (isSecretKey(normalized)) {
            return REDACTED;
        }

        if (
            IDENTIFIER_KEYS.has(normalized) &&
            (typeof value === 'string' ||
                typeof value === 'number' ||
                typeof value === 'boolean') &&
            value !== ''
        ) {
            return this.pseudonymize(String(value));
        }

        if (Array.isArray(value)) {
            return this.redact(value);
        }

        if (typeof value === 'object' && value !== null) {
            return this.redact(value as Record<string, unknown>);
        }

        if (typeof value === 'string') {
            return this.redactText(value);
        }

        return value;
    }

    /**
     * sweepAssignments() reads `https:` as a key and swallows the rest of the
     * URL, so query parameters get their own pass.
     */
    private sweepQueryParameters(text: string): string {
        return text.replace(
            QUERY_PARAMETER_PATTERN,
            (match, separator: string, key: string) =>
                isSecretKey(normalizeKey(key))
                    ? `${separator}${key}=${REDACTED}`
                    : match,
        );
    }

    /** `"username":"u1001"` / `username=u1001` / `'ticket' => 'abc123'`. */
    private sweepAssignments(
        text: string,
        pseudonymizeIdentifiers: boolean,
    ): string {
        return text.replace(
            ASSIGNMENT_PATTERN,
            (
                match: string,
                prefix: string,
                key: string,
                quote: string,
                value: string,
                closingQuote: string,
            ) => {
                const normalized = normalizeKey(key);

                if (isSecretKey(normalized)) {
                    return `${prefix}${quote}${REDACTED}${closingQuote}`;
                }

                if (
                    pseudonymizeIdentifiers &&
                    IDENTIFIER_KEYS.has(normalized)
                ) {
                    return `${prefix}${quote}${this.pseudonymize(value)}${closingQuote}`;
                }

                return match;
            },
        );
    }
}

function normalizeKey(key: string): string {
    return key.toLowerCase().replace(/[_\- ]/g, '');
}

function isSecretKey(normalizedKey: string): boolean {
    return (
        SECRET_KEYS.has(normalizedKey) ||
        SECRET_KEY_FRAGMENTS.some((fragment) =>
            normalizedKey.includes(fragment),
        )
    );
}

interface UrlParts {
    scheme?: string;
    host?: string;
    port?: string;
    path?: string;
    query?: string;
}

/** The slice of PHP `parse_url` the redactor relies on. */
function parseUrl(url: string): UrlParts {
    const match =
        /^(?:([A-Za-z][A-Za-z0-9+.-]*):)?(?:\/\/(?:[^@/?#]*@)?([^:/?#]*)(?::(\d+))?)?([^?#]*)(?:\?([^#]*))?(?:#.*)?$/.exec(
            url,
        );

    if (match === null) {
        return {};
    }

    return {
        scheme: match[1],
        host: match[2],
        port: match[3],
        path: match[4] === '' ? undefined : match[4],
        query: match[5],
    };
}

/**
 * PHP `parse_str` for flat parameters: percent/plus decoded, `.` and space in
 * names become `_`, later duplicates overwrite earlier ones in place.
 */
function parseQueryString(query: string): Map<string, string> {
    const result = new Map<string, string>();

    for (const pair of query.split('&')) {
        if (pair === '') {
            continue;
        }

        const separator = pair.indexOf('=');
        const rawKey = separator === -1 ? pair : pair.slice(0, separator);
        const rawValue = separator === -1 ? '' : pair.slice(separator + 1);
        const key = safeDecode(rawKey).replace(/[. ]/g, '_');

        result.set(key, safeDecode(rawValue));
    }

    return result;
}

function safeDecode(value: string): string {
    const spaced = value.replace(/\+/g, ' ');

    try {
        return decodeURIComponent(spaced);
    } catch {
        return spaced;
    }
}
