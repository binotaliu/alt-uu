import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  LaravelDecryptError,
  LaravelEncrypter,
  parseLaravelAppKey,
} from './laravelEncrypter';
import {
  FIXTURE_APP_KEY,
  FIXTURE_PREVIOUS_APP_KEY,
  legacyFixturePath,
} from './__fixtures__';

function fixtureAccountColumns(id: number) {
  const sqlite = new Database(legacyFixturePath('legacy-current'), {
    readonly: true,
    fileMustExist: true,
  });

  try {
    return sqlite
      .prepare(
        'SELECT password, hungu_session, school_portal_session FROM accounts WHERE id = ?',
      )
      .get(id) as {
      password: string;
      hungu_session: string | null;
      school_portal_session: string | null;
    };
  } finally {
    sqlite.close();
  }
}

describe('parseLaravelAppKey', () => {
  it('decodes base64: keys and accepts raw 32-byte keys', () => {
    expect(parseLaravelAppKey(FIXTURE_APP_KEY)).toEqual(
      new Uint8Array(Array.from({ length: 32 }, (_, index) => index)),
    );
    expect(parseLaravelAppKey('a'.repeat(32))).toHaveLength(32);
  });

  it('rejects keys of the wrong length', () => {
    expect(() => parseLaravelAppKey('base64:AAAA')).toThrow(
      LaravelDecryptError,
    );
    expect(() => parseLaravelAppKey('short')).toThrow(LaravelDecryptError);
  });
});

describe('LaravelEncrypter (PHP-encrypted fixture values)', () => {
  it('decrypts the `encrypted` cast (encryptString, no serialize)', () => {
    const encrypter = new LaravelEncrypter([FIXTURE_APP_KEY]);

    expect(encrypter.decryptString(fixtureAccountColumns(1).password)).toBe(
      'pässword-1',
    );
  });

  it('decrypts the `encrypted:array` cast as JSON', () => {
    const encrypter = new LaravelEncrypter([FIXTURE_APP_KEY]);
    const columns = fixtureAccountColumns(1);

    expect(encrypter.decryptJson(columns.hungu_session ?? '')).toEqual({
      base_url: 'https://uu.nou.edu.tw',
      ua: 'AltUU/1.1.0',
      cookies: { WM: 'wm-cookie', idx: '42' },
      ticket: 'ticket-1',
      session_idx: 7,
      profile: { username: 's1111111', realname: '王小明' },
    });
    expect(encrypter.decryptJson(columns.school_portal_session ?? '')).toEqual({
      base_url: 'https://nouapp.nou.edu.tw',
      ua: 'AltUU/1.1.0',
      cookies: [],
    });
  });

  it('falls back to APP_PREVIOUS_KEYS like Laravel', () => {
    const rotated = fixtureAccountColumns(3).password;

    expect(() =>
      new LaravelEncrypter([FIXTURE_APP_KEY]).decryptString(rotated),
    ).toThrow('The MAC is invalid.');
    expect(
      new LaravelEncrypter([
        FIXTURE_APP_KEY,
        FIXTURE_PREVIOUS_APP_KEY,
      ]).decryptString(rotated),
    ).toBe('rotated-pass-3');
  });

  it('rejects tampered and malformed payloads', () => {
    const encrypter = new LaravelEncrypter([FIXTURE_APP_KEY]);
    const payload = JSON.parse(
      Buffer.from(fixtureAccountColumns(1).password, 'base64').toString(),
    ) as Record<string, string>;
    const tampered = Buffer.from(
      JSON.stringify({ ...payload, value: `A${payload.value.slice(1)}` }),
    ).toString('base64');

    expect(() => encrypter.decryptString(tampered)).toThrow(
      'The MAC is invalid.',
    );
    expect(() => encrypter.decryptString('not-a-payload')).toThrow(
      'The payload is invalid.',
    );
  });
});
