import { gcm } from '@noble/ciphers/aes.js';
import type { RandomBytes, SecureStorage } from '../platform';

const DATA_KEY_STORAGE_KEY = 'altuu.data-key.v1';
const PAYLOAD_PREFIX = 'v1:';
const KEY_BYTES = 32;
const NONCE_BYTES = 12;

const BASE64_ALPHABET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
    let output = '';

    for (let index = 0; index < bytes.length; index += 3) {
        const chunk =
            (bytes[index] << 16) |
            ((bytes[index + 1] ?? 0) << 8) |
            (bytes[index + 2] ?? 0);

        output += BASE64_ALPHABET[(chunk >> 18) & 63];
        output += BASE64_ALPHABET[(chunk >> 12) & 63];
        output +=
            index + 1 < bytes.length ? BASE64_ALPHABET[(chunk >> 6) & 63] : '=';
        output += index + 2 < bytes.length ? BASE64_ALPHABET[chunk & 63] : '=';
    }

    return output;
}

export function base64ToBytes(value: string): Uint8Array {
    const clean = value.replace(/=+$/, '');
    const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
    let buffer = 0;
    let bits = 0;
    let offset = 0;

    for (const character of clean) {
        const sextet = BASE64_ALPHABET.indexOf(character);

        if (sextet === -1) {
            throw new Error('Invalid base64 input.');
        }

        buffer = (buffer << 6) | sextet;
        bits += 6;

        if (bits >= 8) {
            bits -= 8;
            bytes[offset++] = (buffer >> bits) & 0xff;
        }
    }

    return bytes;
}

/**
 * AES-256-GCM encryption for secrets stored in SQLite (passwords and
 * sessions). The random 256-bit data key lives in {@link SecureStorage}; the
 * database only ever sees `v1:<base64(nonce || ciphertext || tag)>`.
 *
 * The `purpose` (e.g. the column name) is bound as additional authenticated
 * data so a ciphertext cannot be swapped between columns.
 */
export class CredentialCipher {
    private dataKey: Promise<Uint8Array> | null = null;

    constructor(
        private readonly secureStorage: SecureStorage,
        private readonly random: RandomBytes,
    ) {}

    async encrypt(plaintext: string, purpose: string): Promise<string> {
        const key = await this.resolveDataKey();
        const nonce = this.random.getRandomBytes(NONCE_BYTES);
        const sealed = gcm(key, nonce, encode(purpose)).encrypt(
            encode(plaintext),
        );

        const payload = new Uint8Array(nonce.length + sealed.length);
        payload.set(nonce, 0);
        payload.set(sealed, nonce.length);

        return PAYLOAD_PREFIX + bytesToBase64(payload);
    }

    async decrypt(payload: string, purpose: string): Promise<string> {
        if (!payload.startsWith(PAYLOAD_PREFIX)) {
            throw new Error('Unsupported ciphertext format.');
        }

        const key = await this.resolveDataKey();
        const bytes = base64ToBytes(payload.slice(PAYLOAD_PREFIX.length));
        const nonce = bytes.slice(0, NONCE_BYTES);
        const sealed = bytes.slice(NONCE_BYTES);

        return new TextDecoder().decode(
            gcm(key, nonce, encode(purpose)).decrypt(sealed),
        );
    }

    async encryptJson(value: unknown, purpose: string): Promise<string> {
        return this.encrypt(JSON.stringify(value), purpose);
    }

    async decryptJson<T>(payload: string, purpose: string): Promise<T> {
        return JSON.parse(await this.decrypt(payload, purpose)) as T;
    }

    private resolveDataKey(): Promise<Uint8Array> {
        this.dataKey ??= this.loadOrCreateDataKey().catch((error: unknown) => {
            this.dataKey = null;
            throw error;
        });

        return this.dataKey;
    }

    private async loadOrCreateDataKey(): Promise<Uint8Array> {
        const stored = await this.secureStorage.getItem(DATA_KEY_STORAGE_KEY);

        if (stored !== null) {
            const key = base64ToBytes(stored);

            if (key.length === KEY_BYTES) {
                return key;
            }
        }

        const key = this.random.getRandomBytes(KEY_BYTES);
        await this.secureStorage.setItem(
            DATA_KEY_STORAGE_KEY,
            bytesToBase64(key),
        );

        return key;
    }
}

function encode(value: string): Uint8Array {
    return new TextEncoder().encode(value);
}
