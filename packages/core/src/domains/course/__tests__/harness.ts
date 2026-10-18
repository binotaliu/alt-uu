/**
 * Test harness for the course domain: the real HUNGU client stack over a
 * fake fetch, an in-memory SQLite database and the course services.
 */
import { createTestContext } from '../../../../test/db/helpers';
import { defaultHunguConfig } from '../../../hungu/config';
import { HunguCourseClient } from '../../../hungu/hunguApis';
import { HunguClient } from '../../../hungu/hunguClient';
import type { HunguSessionData } from '../../../hungu/types';
import {
  createFakeFetch,
  InMemorySessionStore,
  type FakeResponder,
  type RecordedRequest,
} from '../../../http/testing';
import type { Fetch, FetchResponse } from '../../../platform';
import type { HunguSession } from '../../../session/types';
import { createHunguMaterialContentClient } from '../material/hunguMaterialContentClient';
import { createCourseServices, type CourseServicesDeps } from '../services';

export interface ByteReply {
  status?: number;
  headers?: Record<string, string>;
  bytes: Uint8Array;
}

export interface HarnessOptions {
  routes?: Array<[string | RegExp, FakeResponder]>;
  /** Exact URL → binary body (served for GET). */
  byteRoutes?: Record<string, ByteReply>;
  session?: Partial<HunguSessionData> | null;
  services?: Partial<CourseServicesDeps>;
}

export const DEFAULT_SESSION: HunguSessionData = {
  baseUrl: 'https://uu.nou.edu.tw',
  userAgent: 'test-agent',
  ticket: 'ticket-1',
  session_idx: 'idx-1',
  cookies: { WM: 'cookie' },
  profile: {
    display_name: '測試',
    username: 's123',
    picture: '',
    realname: '',
  },
};

export async function createCourseHarness(options: HarnessOptions = {}) {
  const ctx = await createTestContext();
  const sessions = new InMemorySessionStore<HunguSession>(1);

  if (options.session !== null) {
    await sessions.put({ ...DEFAULT_SESSION, ...(options.session ?? {}) });
  }

  const fake = createFakeFetch(options.routes ?? []);
  const requests: RecordedRequest[] = fake.requests;
  const byteRoutes = options.byteRoutes ?? {};
  const fetch: Fetch = async (url, init = {}) => {
    const reply = byteRoutes[url];
    const method = (init.method ?? 'GET').toUpperCase();

    if (reply === undefined || method !== 'GET') {
      return fake.fetch(url, init);
    }

    requests.push({
      url,
      method,
      headers: Object.fromEntries(
        Object.entries(init.headers ?? {}).map(([name, value]) => [
          name.toLowerCase(),
          value,
        ]),
      ),
      body: null,
      redirect: init.redirect,
    });

    return bytesResponse(reply);
  };
  const hungu = new HunguClient({
    fetch,
    sessionStore: sessions,
    config: defaultHunguConfig,
  });
  const course = new HunguCourseClient(hungu);
  const services = createCourseServices({
    client: course,
    materialContent: createHunguMaterialContentClient({ hungu, fetch }),
    cache: ctx.cache,
    activeAccount: { currentAccountId: async () => 1 },
    hunguSessionStore: sessions,
    db: ctx.db,
    ...options.services,
  });

  return { ctx, sessions, requests, hungu, course, services };
}

export function bytesResponse(reply: ByteReply): FetchResponse {
  const headers = new Map(
    Object.entries(reply.headers ?? {}).map(([name, value]) => [
      name.toLowerCase(),
      value,
    ]),
  );

  return {
    status: reply.status ?? 200,
    headers: { get: (name) => headers.get(name.toLowerCase()) ?? null },
    setCookies: () => [],
    text: async () => new TextDecoder().decode(reply.bytes),
    arrayBuffer: async () =>
      reply.bytes.buffer.slice(
        reply.bytes.byteOffset,
        reply.bytes.byteOffset + reply.bytes.byteLength,
      ) as ArrayBuffer,
  };
}

/** `action=…` of the xmlapi requests, plus `METHOD url` of the others. */
export function describeRequests(requests: RecordedRequest[]): string[] {
  return requests.map((request) => {
    const action = /\/xmlapi\/index\.php\?action=([^&]+)/.exec(request.url);

    return action !== null
      ? `xmlapi ${action[1]}`
      : `${request.method} ${request.url}`;
  });
}
