import { cbc } from '@noble/ciphers/aes.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { base64ToBytes } from '../db/cipher';

const KEY_BYTES = 32;
const IV_BYTES = 16;

export class LaravelDecryptError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LaravelDecryptError';
    }
}

/**
 * Parses a Laravel `APP_KEY` (`base64:...` or a raw 32-character string)
 * into the 32-byte AES-256-CBC key.
 */
export function parseLaravelAppKey(appKey: string): Uint8Array {
    const trimmed = appKey.trim();
    const key = trimmed.startsWith('base64:')
        ? base64ToBytes(trimmed.slice('base64:'.length))
        : new TextEncoder().encode(trimmed);

    if (key.length !== KEY_BYTES) {
        throw new LaravelDecryptError(
            'Unsupported APP_KEY: AES-256-CBC needs a 32-byte key.',
        );
    }

    return key;
}

interface LaravelPayload {
    iv: string;
    value: string;
    mac: string;
}

/**
 * Decrypt-only port of `Illuminate\Encryption\Encrypter` for the
 * `AES-256-CBC` cipher (the legacy `config/app.php` cipher).
 *
 * Payload: base64(JSON {iv, value, mac, tag}) where `iv` and `value` are
 * base64 strings and `mac = hex(HMAC-SHA256(key, iv . value))` over those
 * base64 strings. Like Laravel, every key (current first, then
 * `APP_PREVIOUS_KEYS`) is tried and the first key with a valid MAC wins.
 */
export class LaravelEncrypter {
    private readonly keys: Uint8Array[];

    /** @param appKeys current key first, then previous keys. */
    constructor(appKeys: readonly string[]) {
        this.keys = appKeys.map(parseLaravelAppKey);

        if (this.keys.length === 0) {
            throw new LaravelDecryptError('At least one APP_KEY is required.');
        }
    }

    /**
     * `Crypt::decryptString` / `decrypt($payload, false)`: what the
     * `encrypted` and `encrypted:array` Eloquent casts store.
     */
    decryptString(payload: string): string {
        const parsed = parsePayload(payload);
        const key = this.keys.find((candidate) => validMac(parsed, candidate));

        if (key === undefined) {
            throw new LaravelDecryptError('The MAC is invalid.');
        }

        try {
            const plaintext = cbc(key, base64ToBytes(parsed.iv)).decrypt(
                base64ToBytes(parsed.value),
            );

            return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
        } catch {
            throw new LaravelDecryptError('Could not decrypt the data.');
        }
    }

    /** `encrypted:array` cast: decryptString + json_decode (assoc). */
    decryptJson(payload: string): unknown {
        try {
            return JSON.parse(this.decryptString(payload)) as unknown;
        } catch (error) {
            if (error instanceof LaravelDecryptError) {
                throw error;
            }

            throw new LaravelDecryptError('Decrypted value is not JSON.');
        }
    }
}

function parsePayload(payload: string): LaravelPayload {
    let decoded: unknown;

    try {
        decoded = JSON.parse(
            new TextDecoder().decode(base64ToBytes(payload.trim())),
        ) as unknown;
    } catch {
        throw new LaravelDecryptError('The payload is invalid.');
    }

    if (decoded === null || typeof decoded !== 'object') {
        throw new LaravelDecryptError('The payload is invalid.');
    }

    const { iv, value, mac } = decoded as Record<string, unknown>;

    if (
        typeof iv !== 'string' ||
        typeof value !== 'string' ||
        typeof mac !== 'string'
    ) {
        throw new LaravelDecryptError('The payload is invalid.');
    }

    let ivLength: number;

    try {
        ivLength = base64ToBytes(iv).length;
    } catch {
        throw new LaravelDecryptError('The payload is invalid.');
    }

    if (ivLength !== IV_BYTES) {
        throw new LaravelDecryptError('The payload is invalid.');
    }

    return { iv, value, mac };
}

function validMac(payload: LaravelPayload, key: Uint8Array): boolean {
    const expected = toHex(
        hmac(sha256, key, new TextEncoder().encode(payload.iv + payload.value)),
    );

    return constantTimeEquals(expected, payload.mac);
}

function toHex(bytes: Uint8Array): string {
    let hex = '';

    for (const byte of bytes) {
        hex += byte.toString(16).padStart(2, '0');
    }

    return hex;
}

function constantTimeEquals(left: string, right: string): boolean {
    if (left.length !== right.length) {
        return false;
    }

    let difference = 0;

    for (let index = 0; index < left.length; index++) {
        difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }

    return difference === 0;
}
