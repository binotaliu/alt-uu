const ALPHABET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard padded base64 (PHP `base64_encode`). No btoa dependency. */
export function bytesToBase64(bytes: Uint8Array): string {
    let output = '';

    for (let index = 0; index < bytes.length; index += 3) {
        const a = bytes[index];
        const b = bytes[index + 1];
        const c = bytes[index + 2];
        const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);

        output += ALPHABET[(triple >> 18) & 63];
        output += ALPHABET[(triple >> 12) & 63];
        output += b === undefined ? '=' : ALPHABET[(triple >> 6) & 63];
        output += c === undefined ? '=' : ALPHABET[triple & 63];
    }

    return output;
}

export function base64ToBytes(input: string): Uint8Array {
    const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
    const bytes: number[] = [];
    let buffer = 0;
    let bits = 0;

    for (const char of clean) {
        buffer = (buffer << 6) | ALPHABET.indexOf(char);
        bits += 6;

        if (bits >= 8) {
            bits -= 8;
            bytes.push((buffer >> bits) & 0xff);
        }
    }

    return Uint8Array.from(bytes);
}
