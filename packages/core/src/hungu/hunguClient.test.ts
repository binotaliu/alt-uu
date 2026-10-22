import { beforeEach, describe, expect, it } from 'vitest';

import { SessionInvalidError } from '../errors/errors';
import { createFakeFetch, InMemorySessionStore } from '../http/testing';
import type { HunguSession } from '../session/types';
import { defaultHunguConfig, type HunguConfig } from './config';
import {
  HunguCourseClient,
  HunguDiscussClient,
  HunguStudyTimeClient,
} from './hunguApis';
import { HunguClient } from './hunguClient';
import type { HunguSessionData } from './types';
import { UUCrypto } from './uuCrypto';

class FakeCrypto extends UUCrypto {
  override encryptImmediately(input: string): string {
    return `ENC(${input})`;
  }
}

const config: HunguConfig = {
  ...defaultHunguConfig,
  userAgent: 'config-agent',
};

const session = (): HunguSessionData => ({
  baseUrl: 'https://uu.example/xmlapi/index.php',
  userAgent: 'UA X',
  ticket: 'T1',
  session_idx: 'I1',
  cookies: { WM: 'w', b: 'c d' },
});

const JSON_ACCEPT = 'application/json, application/json,text/plain,*/*';

describe('HunguClient', () => {
  let store: InMemorySessionStore<HunguSession>;

  beforeEach(async () => {
    store = new InMemorySessionStore<HunguSession>(1);
    await store.put(session());
  });

  const makeClient = (routes: Parameters<typeof createFakeFetch>[0]) => {
    const fake = createFakeFetch(routes);
    const client = new HunguClient({
      fetch: fake.fetch,
      sessionStore: store,
      config,
      crypto: new FakeCrypto(),
    });

    return { client, requests: fake.requests };
  };

  // Request shapes below were captured from the legacy UUProxyClient
  // with Http::fake (see the step 2 report).
  it('logs in with warm-up cookies and the legacy JSON body', async () => {
    const { client, requests } = makeClient([
      [
        'https://uu.example/',
        {
          body: '<html/>',
          setCookies: ['PHPSESSID=home; path=/', 'a=1'],
        },
      ],
      [
        'https://uu.example/learn/index.php',
        { body: '<html/>', setCookies: ['WMSESSID=learn; path=/'] },
      ],
      [
        'https://uu.example/xmlapi/index.php?action=login*',
        {
          body: {
            code: 0,
            data: { cookie_data: [{ name: 'WM', value: 'x' }] },
          },
          setCookies: ['later=2'],
        },
      ],
    ]);

    const result = await client.login(
      'https://uu.example/xmlapi',
      'UA X',
      ' s123 ',
      'p w&d',
    );

    expect(result.cookies).toEqual({
      PHPSESSID: 'home',
      a: '1',
      WMSESSID: 'learn',
      later: '2',
      WM: 'x',
    });
    expect(requests.map((request) => [request.method, request.url])).toEqual([
      ['GET', 'https://uu.example/'],
      ['GET', 'https://uu.example/learn/index.php'],
      ['POST', 'https://uu.example/xmlapi/index.php?action=login&ua=UA%20X'],
    ]);
    expect(requests[0].headers).toEqual({
      accept:
        'application/json, text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      origin: 'https://uu.example',
      referer: 'https://uu.example/learn/index.php',
      'user-agent': 'UA X',
    });
    expect(requests[1].headers.cookie).toBe('PHPSESSID=home; a=1');
    expect(requests[2].headers).toEqual({
      accept: 'application/json, */*',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      cookie: 'PHPSESSID=home; a=1; WMSESSID=learn',
      origin: 'https://uu.example',
      referer: 'https://uu.example/learn/index.php',
      'user-agent': 'UA X',
    });
    expect(requests[2].body).toBe(
      '{"username":"ENC(s123)","password":"ENC(p w&d)","kickOff":true}',
    );
  });

  it('sends kickOff=false in debug builds and accepts associative cookie_data', async () => {
    const fake = createFakeFetch([
      [
        'https://uu.example/*',
        { body: { code: 0, data: { cookie_data: { WM: 5 } } } },
      ],
    ]);
    const client = new HunguClient({
      fetch: fake.fetch,
      sessionStore: store,
      config: { ...config, debug: true },
      crypto: new FakeCrypto(),
    });

    const result = await client.login('https://uu.example', 'UA', 'u', 'p');

    expect(fake.requests[2].body).toContain('"kickOff":false');
    expect(result.cookies).toEqual({ WM: '5' });
  });

  it('builds xmlapi requests like the legacy client and merges Set-Cookie into the session', async () => {
    const { client, requests } = makeClient([
      ['*', { body: { code: 0 }, setCookies: ['later=2'] }],
    ]);

    const result = await client.request('my-course-list', {
      params: {
        offset: 0,
        pagesize: 100,
        empty: '',
        nul: null,
        arr: { a: 1, b: [2, 3] },
        sp: 'a b+c',
      },
    });

    expect(result.payload).toEqual({ code: 0 });
    expect(requests[0].url).toBe(
      'https://uu.example/xmlapi/index.php?action=my-course-list&ticket=T1&ua=UA+X&offset=0&pagesize=100&arr%5Ba%5D=1&arr%5Bb%5D%5B0%5D=2&arr%5Bb%5D%5B1%5D=3&sp=a+b%2Bc',
    );
    expect(requests[0].headers).toEqual({
      accept: JSON_ACCEPT,
      cookie: 'WM=w; b=c d',
      origin: 'https://uu.example',
      referer: 'https://uu.example/learn/index.php',
      'user-agent': 'UA X',
    });
    expect((await store.get())?.cookies).toEqual({
      WM: 'w',
      b: 'c d',
      later: '2',
    });
  });

  it('encodes form and JSON bodies like the legacy client', async () => {
    const { client, requests } = makeClient([['*', { body: { code: 0 } }]]);

    await client.request('set-read-node-history', {
      method: 'POST',
      body: { x: 'y z', n: null, f: false, t: true, nested: { k: 'v' } },
    });
    await client.request('add-course-post', {
      method: 'POST',
      body: {
        board_id: '1',
        content: '中文 <b>',
        attaches: [],
        slash: 'a/b',
      },
      bodyType: 'json',
    });
    await client.requestOnPath('/mooc/controllers/forum_ajax.php', {
      method: 'POST',
      body: { bid: '1', sid: 1000110001 },
    });

    expect(requests[0]).toMatchObject({
      url: 'https://uu.example/xmlapi/index.php?action=set-read-node-history&ticket=T1&ua=UA+X',
      body: 'x=y+z&f=0&t=1&nested%5Bk%5D=v',
    });
    expect(requests[0].headers['content-type']).toBe(
      'application/x-www-form-urlencoded; charset=UTF-8',
    );
    expect(requests[1].body).toBe(
      '{"board_id":"1","content":"\\u4e2d\\u6587 <b>","attaches":[],"slash":"a\\/b"}',
    );
    expect(requests[1].headers['content-type']).toBe('application/json');
    expect(requests[2]).toMatchObject({
      url: 'https://uu.example/mooc/controllers/forum_ajax.php',
      body: 'bid=1&sid=1000110001',
    });
  });

  it('falls back to session_idx when there is no ticket', async () => {
    await store.put({ ...session(), ticket: '' });
    const { client, requests } = makeClient([['*', { body: { code: 0 } }]]);

    await client.request('get-server-time');

    expect(requests[0].url).toBe(
      'https://uu.example/xmlapi/index.php?action=get-server-time&ticket=I1&ua=UA+X',
    );
  });

  // Ported from tests/Unit/UUProxyClientTest.php
  it('retries request once after 403 when reauthentication succeeds', async () => {
    const { client } = makeClient([
      [
        '*',
        [
          { status: 403, body: { code: 401 } },
          { body: { code: 0, data: { ok: true } } },
        ],
      ],
    ]);
    let reauthAttempted = false;
    client.setReauthenticationHandler(async () => {
      reauthAttempted = true;

      return true;
    });

    const result = await client.request('my-course-list');

    expect(reauthAttempted).toBe(true);
    expect(result.payload).toEqual({ code: 0, data: { ok: true } });
  });

  it('does not retry after 403 when reauthentication fails', async () => {
    const { client, requests } = makeClient([
      ['*', [{ status: 403, body: { code: 401 } }]],
    ]);
    let reauthAttempted = false;
    client.setReauthenticationHandler(async () => {
      reauthAttempted = true;

      return false;
    });

    const result = await client.request('my-course-list');

    expect(reauthAttempted).toBe(true);
    expect(result.payload.code).toBe(401);
    expect(requests).toHaveLength(1);
  });

  it.each([
    ['payload code 403', { body: { code: 403 } }],
    ['payload code 1', { body: { code: 1 } }],
    [
      'an access denied message',
      { body: { code: 9, message: 'Access Denied!' } },
    ],
  ])('treats %s as forbidden and retries only once', async (_label, reply) => {
    const { client, requests } = makeClient([['*', () => reply]]);
    let attempts = 0;
    client.setReauthenticationHandler(async () => {
      attempts += 1;

      return true;
    });

    await client.request('my-profile');

    expect(attempts).toBe(1);
    expect(requests).toHaveLength(2);
  });

  it('treats a throwing reauthentication handler as a failed re-login', async () => {
    const { client } = makeClient([
      ['*', { status: 403, body: { code: 401 } }],
    ]);
    client.setReauthenticationHandler(async () => {
      throw new Error('boom');
    });

    await expect(client.request('my-profile')).resolves.toEqual({
      payload: { code: 401 },
    });
  });

  it('retries requestOnPath only on HTTP 403', async () => {
    const { client, requests } = makeClient([
      ['*', () => ({ body: { code: 1 } })],
    ]);
    client.setReauthenticationHandler(async () => true);

    await client.requestOnPath('/mooc/controllers/forum_ajax.php');

    expect(requests).toHaveLength(1);
  });

  it('uses the session account when one is given', async () => {
    await store.put({ ...session(), ticket: 'T2', cookies: { WM: 'two' } }, 2);
    const { client, requests } = makeClient([
      ['*', { body: { code: 0 }, setCookies: ['n=1'] }],
    ]);

    await new HunguCourseClient(client).fetchCourseList(2);

    expect(requests[0].url).toContain('action=my-course-list&ticket=T2');
    expect(requests[0].headers.cookie).toBe('WM=two');
    expect((await store.get(2))?.cookies).toEqual({ WM: 'two', n: '1' });
    expect((await store.get(1))?.cookies).toEqual({ WM: 'w', b: 'c d' });
  });

  it('does not write cookies back over a session replaced by a re-login meanwhile', async () => {
    const { client } = makeClient([
      [
        '*',
        async () => {
          await store.put({
            ...session(),
            ticket: 'NEW',
            cookies: { WM: 'fresh' },
          });

          return { body: { code: 0 }, setCookies: ['stale=1'] };
        },
      ],
    ]);

    await client.request('my-course-list');

    expect((await store.get())?.cookies).toEqual({ WM: 'fresh' });
  });

  it('drops cookies the server expires', async () => {
    const { client } = makeClient([
      [
        '*',
        {
          body: {},
          setCookies: ['WM=deleted; expires=Thu, 01-Jan-1970 00:00:01 GMT'],
        },
      ],
    ]);

    await client.fetchMaterialContent('https://uu.example/learn/x.html');

    expect((await store.get())?.cookies).toEqual({ b: 'c d' });
  });

  it('fetches pages as raw content with a default content type', async () => {
    const { client, requests } = makeClient([
      ['*', { body: '<html>', headers: {} }],
    ]);

    const page = await client.fetchCourseLearningTimePage('a b');

    expect(page).toEqual({
      status: 200,
      body: '<html>',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
    expect(requests[0].url).toBe(
      'https://uu.example/learn/last10.php?class_id=a%20b',
    );
    expect(requests[0].headers.accept).toBe('application/json, */*');
  });

  it.each([
    ['fetchCourseHomeworkPage', '/learn/homework/homework_list.php'],
    ['fetchCourseSelfExamPage', '/learn/exam/co_self_exam_list.php'],
    ['fetchPendingHomeworkPage', '/learn/my_homework.php'],
    ['fetchUnreadArticlesPage', '/learn/my_forum.php'],
    ['fetchCoursePathTree', '/learn/path/pathtree.php'],
  ] as const)('%s fetches %s', async (method, path) => {
    const { client, requests } = makeClient([['*', { body: '' }]]);

    await client[method]();

    expect(requests[0].url).toBe(`https://uu.example${path}`);
  });

  it('probes content type with HEAD', async () => {
    const { client, requests } = makeClient([
      [
        '*',
        {
          headers: {
            'content-type': 'application/pdf',
            'content-length': ' ',
          },
        },
      ],
    ]);

    expect(
      await client.probeContentType('https://uu.example/learn/y.pdf'),
    ).toEqual({
      status: 200,
      contentType: 'application/pdf',
      contentLength: null,
    });
    expect(requests[0].method).toBe('HEAD');
  });

  it('hands off material fetches with the session headers and cookies', async () => {
    const { client } = makeClient([]);

    expect(await client.materialFetchHandoff('https://uu.example/z')).toEqual({
      url: 'https://uu.example/z',
      headers: {
        'User-Agent': 'UA X',
        Origin: 'https://uu.example',
        Referer: 'https://uu.example/learn/index.php',
        Cookie: 'WM=w; b=c d',
        Accept: '*/*',
      },
      baseUrl: 'https://uu.example',
      cookies: { WM: 'w', b: 'c d' },
    });
  });

  it('sets a single cookie on the session', async () => {
    const { client } = makeClient([]);

    await client.setCookie('browserTabIdx', '7');

    expect((await store.get())?.cookies).toEqual({
      WM: 'w',
      b: 'c d',
      browserTabIdx: '7',
    });
  });

  it('throws SessionInvalidError without a session unless a handler provides one', async () => {
    await store.clear();
    const { client, requests } = makeClient([['*', { body: { code: 0 } }]]);

    await expect(client.request('my-profile')).rejects.toBeInstanceOf(
      SessionInvalidError,
    );

    client.setMissingSessionHandler(async () => {
      await store.put(session());

      return session();
    });

    await expect(client.request('my-profile')).resolves.toEqual({
      payload: { code: 0 },
    });
    expect(requests).toHaveLength(1);
  });

  it('maps discuss and study-time wrappers to the legacy actions', async () => {
    const { client, requests } = makeClient([['*', { body: { code: 0 } }]]);
    const discuss = new HunguDiscussClient(client);
    const studyTime = new HunguStudyTimeClient(client);

    await discuss.fetchBoardNodeList('b1');
    await discuss.createPost({ boardId: 'b1', subject: 's', content: 'c' });
    await discuss.updatePost({ postId: 'p1', content: 'c2' });
    await discuss.createWhisper('b1', 'n1', 'hi');
    await discuss.likePost('b1', 'n1');
    await studyTime.recordStudyTime({ cid: '1', time: 30 });

    expect(requests[0].url).toContain(
      'action=get-board-node-list&ticket=T1&ua=UA+X&offset=0&size=50&bid=b1',
    );
    expect(requests[1].body).toBe(
      '{"board_id":"b1","subject":"s","content":"c","attaches":[]}',
    );
    expect(requests[2].body).toBe(
      '{"post_id":"p1","content":"c2","attaches":[]}',
    );
    expect(requests[3].url).toContain(
      'action=board-whisper-handler&ticket=T1&ua=UA+X&act=set',
    );
    expect(requests[3].body).toBe('{"bid":"b1","nid":"n1","content":"hi"}');
    expect(requests[4].body).toBe(
      'bid=b1&nid=n1&sid=1000110001&action=setPush&firstPush=1',
    );
    expect(requests[5].body).toBe('cid=1&time=30');
  });
});
