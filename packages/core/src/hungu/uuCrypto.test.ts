import { describe, expect, it } from 'vitest';

import vectors from './__vectors__/uu-crypto.vectors.json';
import { base64ToBytes } from './base64';
import { phpTrim, UUCrypto } from './uuCrypto';

interface Vector {
  inputBase64: string;
  code: number;
  raw: string;
  immediate: string;
}

const decode = (base64: string): string =>
  new TextDecoder().decode(base64ToBytes(base64));

describe('UUCrypto', () => {
  const crypto = new UUCrypto();

  it.each(
    (vectors as Vector[]).map((vector) => [
      vector.inputBase64,
      vector.code,
      vector,
    ]),
  )(
    'matches the PHP output for input %s with code %i',
    (_label, code, vector) => {
      const input = decode(vector.inputBase64);

      expect(crypto.encryptRaw(input, code)).toBe(vector.raw);
      expect(crypto.encryptWithCode(input, code)).toBe(vector.immediate);
    },
  );

  it('draws the inner key offset from 8..27 like random_int', () => {
    const bounds: Array<[number, number]> = [];
    const pinned = new UUCrypto((min, max) => {
      bounds.push([min, max]);

      return 13;
    });

    expect(pinned.encryptImmediately('s1234567')).toBe(
      crypto.encryptWithCode('s1234567', 13),
    );
    expect(bounds).toEqual([[8, 27]]);
  });

  it('produces decryptable output with the default random source', () => {
    const encrypted = crypto.encryptImmediately('密碼測試');
    const [inner, code] = crypto.decryptRaw(encrypted, 27).split('@!!@');

    expect(Number(code)).toBeGreaterThanOrEqual(8);
    expect(Number(code)).toBeLessThanOrEqual(27);
    expect(crypto.decryptRaw(inner, Number(code))).toBe('密碼測試');
  });

  it('trims only the PHP trim() character set', () => {
    const nbsp = String.fromCharCode(0xa0);

    expect(phpTrim(` \t\n\r\0\x0Bx${nbsp} `)).toBe(`x${nbsp}`);
  });
});
