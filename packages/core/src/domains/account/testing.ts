/**
 * Test-only harness shared by the account-and-local-data domain suites:
 * real storage (in-memory SQLite) + the HUNGU stack over a fake fetch.
 */
import { createFakeFetch, type FakeResponder } from '../../http/testing';
import { createHunguServices, defaultHunguConfig, UUCrypto } from '../../hungu';
import type { HunguSession } from '../../session/types';
import { createTestContext, type FakeClock } from '../../../test/db/helpers';

class FakeCrypto extends UUCrypto {
  override encryptImmediately(input: string): string {
    return `ENC(${input})`;
  }
}

export const invalidAccount = {
  code: 403,
  message: 'invalid account',
  data: [],
};

export function loginSuccess(ticket: string, realname = '測試學生') {
  return {
    code: 0,
    message: 'success',
    data: {
      session_data: { ticket },
      idx_data: { session_idx: `idx-${ticket}` },
      login_data: { realname },
      cookie_data: { WM: `cookie-${ticket}` },
    },
  };
}

export function profileOk(username: string, realname = '測試學生') {
  return {
    code: 0,
    message: 'success',
    data: { username, realname, picture: '' },
  };
}

export type FakeRoutes = Array<[string | RegExp, FakeResponder]>;

/** `GET /` and `/learn/index.php` cookie warm-up that precedes a HUNGU login. */
export const warmUpRoutes: FakeRoutes = [
  [
    'https://uu.nou.edu.tw/',
    { body: '<html/>', setCookies: ['PHPSESSID=home; path=/'] },
  ],
  [
    'https://uu.nou.edu.tw/learn/index.php',
    { body: '<html/>', setCookies: ['WMSESSID=learn; path=/'] },
  ],
];

export async function createHarness(routes: FakeRoutes = []) {
  const ctx = await createTestContext();
  const fake = createFakeFetch([
    ...routes,
    ['*', { body: { code: 0, data: [] } }],
  ]);
  const hungu = createHunguServices({
    fetch: fake.fetch,
    config: defaultHunguConfig,
    sessionStore: ctx.hunguSessions,
    accounts: ctx.credentials,
    activeAccount: ctx.activeProfile,
    crypto: new FakeCrypto(),
  });

  /** Legacy `seedAccountSession`: an account with a stored HUNGU session. */
  async function seedAccount(
    username: string,
    suffix: string,
    activate = false,
  ): Promise<number> {
    const id = await ctx.credentials.upsert({
      username,
      password: 'test-password',
    });
    const session: HunguSession = {
      baseUrl: `https://uu-${suffix}.nou.edu.tw`,
      userAgent: 'test-agent',
      cookies: { WM: `cookie-${suffix}` },
      ticket: `ticket-${suffix}`,
      session_idx: `idx-${suffix}`,
      profile: {
        display_name: `測試學生 ${suffix}`,
        username,
        picture: '',
        realname: `測試學生 ${suffix}`,
      },
    };
    await ctx.hunguSessions.put(session, id);

    if (!activate) {
      return id;
    }

    await ctx.activeProfile.set(id);

    return id;
  }

  return { ...ctx, ...hungu, fake, requests: fake.requests, seedAccount };
}

export type Harness = Awaited<ReturnType<typeof createHarness>>;

/** Moves the harness clock to an absolute instant. */
export function setClockTo(clock: FakeClock, date: Date): void {
  clock.advanceSeconds((date.getTime() - clock.now().getTime()) / 1000);
}
