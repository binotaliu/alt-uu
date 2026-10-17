import { cbc } from '@noble/ciphers/aes.js';
import { md5 } from '@noble/hashes/legacy.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import { base64ToBytes, bytesToBase64 } from './base64';

/** `base64_decode('d2lzZG9tbWFzdGVycHJvZmVzc2lvbmFsYXBw')` */
const APP_AES_STRING = 'wisdommasterprofessionalapp';
/** `base64_decode('U3VuQXBwRW5OZVBwYU51cw==')` */
const APP_AES_IV = utf8ToBytes('SunAppEnNePpaNus');
const ENCODER = new TextEncoder();

/** Inclusive integer range, like PHP `random_int($min, $max)`. */
export type RandomInt = (min: number, max: number) => number;

const defaultRandomInt: RandomInt = (min, max) =>
    min + Math.floor(Math.random() * (max - min + 1));

/**
 * Byte-exact port of the legacy `App\Services\UUCrypto` used to encrypt the
 * HUNGU login username and password: AES-256-CBC with an MD5-derived ASCII
 * key, fixed IV and zero padding over the base64 of the UTF-8 input, applied
 * twice. The inner key offset is random in PHP; inject `randomInt` to pin it.
 */
export class UUCrypto {
    constructor(private readonly randomInt: RandomInt = defaultRandomInt) {}

    encryptImmediately(input: string): string {
        const code = this.randomInt(8, APP_AES_STRING.length);

        return this.encryptWithCode(input, code);
    }

    /** `encryptImmediately` with a fixed inner key offset (8..27). */
    encryptWithCode(input: string, code: number): string {
        const encrypted = this.encryptRaw(input, code);

        return this.encryptRaw(
            `${encrypted}@!!@${code}`,
            APP_AES_STRING.length,
        );
    }

    encryptRaw(input: string, code: number): string {
        if (phpTrim(input) === '') {
            return input;
        }

        const key = makeAesKey(code);
        const padded = zeroPad(
            ENCODER.encode(bytesToBase64(ENCODER.encode(input))),
        );
        const cipher = cbc(key, APP_AES_IV, { disablePadding: true }).encrypt(
            padded,
        );

        return bytesToBase64(cipher);
    }

    /** Inverse of {@link encryptRaw}, for tests and debugging. */
    decryptRaw(input: string, code: number): string {
        const plain = cbc(makeAesKey(code), APP_AES_IV, {
            disablePadding: true,
        }).decrypt(base64ToBytes(input));
        let end = plain.length;

        while (end > 0 && plain[end - 1] === 0) {
            end -= 1;
        }

        return new TextDecoder().decode(
            base64ToBytes(new TextDecoder().decode(plain.subarray(0, end))),
        );
    }
}

function makeAesKey(code: number): Uint8Array {
    const a = bytesToHex(md5(utf8ToBytes(APP_AES_STRING.slice(0, code))));

    return utf8ToBytes(
        bytesToHex(md5(utf8ToBytes(a.slice(0, 4) + a.slice(-4)))),
    );
}

function zeroPad(input: Uint8Array): Uint8Array {
    const remainder = input.length % 16;

    if (remainder === 0) {
        return input;
    }

    const padded = new Uint8Array(input.length + 16 - remainder);
    padded.set(input);

    return padded;
}

/** PHP `trim()` default character set: space, \t, \n, \r, \0, \x0B. */
export function phpTrim(value: string): string {
    // eslint-disable-next-line no-control-regex
    return value.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');
}
