import { describe, expect, it } from 'vitest';

import {
  applySetCookies,
  cookieHeader,
  mergeCookies,
  parseCookieDate,
  parseSetCookie,
  splitSetCookieHeader,
} from './cookies';

const now = new Date('2026-10-17T00:00:00Z');

describe('cookies', () => {
  it('parses the first pair like the legacy extractSetCookies', () => {
    expect(parseSetCookie('PHPSESSID=abc=def; path=/; HttpOnly', now)).toEqual({
      name: 'PHPSESSID',
      value: 'abc=def',
      expired: false,
    });
    expect(parseSetCookie(' a = 1 ', now)).toEqual({
      name: 'a',
      value: '1',
      expired: false,
    });
    expect(parseSetCookie('flagonly; path=/', now)).toBeNull();
  });

  it('treats past Expires and non-positive Max-Age as deletion', () => {
    expect(
      parseSetCookie('x=deleted; expires=Thu, 01-Jan-1970 00:00:01 GMT', now)
        ?.expired,
    ).toBe(true);
    expect(
      parseSetCookie('x=1; Expires=Wed, 21 Oct 2099 07:28:00 GMT', now)
        ?.expired,
    ).toBe(false);
    expect(parseSetCookie('x=1; Max-Age=0', now)?.expired).toBe(true);
    expect(
      parseSetCookie(
        'x=1; Max-Age=60; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        now,
      )?.expired,
    ).toBe(false);
  });

  it('applies Set-Cookie headers onto a copy of the jar', () => {
    const jar = { WM: 'old', keep: '1' };
    const merged = applySetCookies(
      jar,
      ['WM=new; path=/', 'keep=deleted; Max-Age=0', 'fresh=2'],
      now,
    );

    expect(merged).toEqual({ WM: 'new', fresh: '2' });
    expect(jar).toEqual({ WM: 'old', keep: '1' });
  });

  it('splits headers that iOS folded into one comma-joined value', () => {
    expect(
      splitSetCookieHeader(
        'a=1; Path=/; Expires=Wed, 21 Oct 2099 07:28:00 GMT, b=2; HttpOnly,c=3',
      ),
    ).toEqual([
      'a=1; Path=/; Expires=Wed, 21 Oct 2099 07:28:00 GMT',
      'b=2; HttpOnly',
      'c=3',
    ]);
  });

  it('parses RFC 6265 cookie dates', () => {
    expect(
      parseCookieDate('Sun, 06 Nov 1994 08:49:37 GMT')?.toISOString(),
    ).toBe('1994-11-06T08:49:37.000Z');
    expect(
      parseCookieDate('Sunday, 06-Nov-94 08:49:37 GMT')?.toISOString(),
    ).toBe('1994-11-06T08:49:37.000Z');
    expect(parseCookieDate('garbage')).toBeNull();
  });

  it('builds the Cookie header and merges with later sources winning', () => {
    expect(cookieHeader(mergeCookies({ a: '1', b: 'x y' }, { a: '2' }))).toBe(
      'a=2; b=x y',
    );
    expect(cookieHeader({})).toBe('');
  });
});
