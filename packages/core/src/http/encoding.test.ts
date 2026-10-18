import { describe, expect, it } from 'vitest';

import {
  dataGet,
  decodeHtmlEntities,
  decodeJson,
  httpBuildQuery,
  phpJsonEncode,
  rawUrlEncode,
  urlEncode,
} from './encoding';

// Expected strings captured from the legacy Laravel client (Http::recorded()).
describe('PHP-compatible encoding', () => {
  it('matches http_build_query for xmlapi queries', () => {
    expect(
      httpBuildQuery({
        offset: 0,
        pagesize: 100,
        arr: { a: 1, b: [2, 3] },
        sp: 'a b+c',
      }),
    ).toBe(
      'offset=0&pagesize=100&arr%5Ba%5D=1&arr%5Bb%5D%5B0%5D=2&arr%5Bb%5D%5B1%5D=3&sp=a+b%2Bc',
    );
  });

  it('matches http_build_query for form bodies (null skipped, booleans as 1/0)', () => {
    expect(
      httpBuildQuery({
        x: 'y z',
        n: null,
        f: false,
        t: true,
        nested: { k: 'v' },
      }),
    ).toBe('x=y+z&f=0&t=1&nested%5Bk%5D=v');
  });

  it('matches json_encode default escaping', () => {
    expect(
      phpJsonEncode({
        board_id: '1',
        content: '中文 <b>',
        attaches: [],
        slash: 'a/b',
      }),
    ).toBe(
      '{"board_id":"1","content":"\\u4e2d\\u6587 <b>","attaches":[],"slash":"a\\/b"}',
    );
    expect(phpJsonEncode('🙂')).toBe('"\\ud83d\\ude42"');
  });

  it('matches rawurlencode and urlencode', () => {
    expect(rawUrlEncode("UA X!'()*~")).toBe('UA%20X%21%27%28%29%2A~');
    expect(urlEncode('a b~')).toBe('a+b%7E');
  });

  it('decodes JSON like $response->json()', () => {
    expect(decodeJson('{"code":0}')).toEqual({ code: 0 });
    expect(decodeJson('<html>')).toBeNull();
    expect(decodeJson('')).toBeNull();
  });

  it('reads nested values like Arr::get', () => {
    expect(dataGet({ a: { b: { c: 1 } } }, 'a.b.c')).toBe(1);
    expect(dataGet({ a: 1 }, 'a.b')).toBeUndefined();
  });

  it('decodes HTML entities in attribute values', () => {
    expect(decodeHtmlEntities('tok&amp;1&#39;&#x41;&lt;')).toBe("tok&1'A<");
  });
});
