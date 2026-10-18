import { describe, expect, it, vi } from 'vitest';

import { SessionInvalidError } from '../errors/errors';
import {
  createFakeFetch,
  InMemorySessionStore,
  type FakeResponder,
} from '../http/testing';
import type {
  AccountCredentials,
  AccountId,
  HunguSession,
} from '../session/types';
import { defaultHunguConfig } from './config';
import { createHunguServices } from './createHunguServices';
import type { HunguAccountRepository } from './hunguSessionAuthenticator';
import type { HunguSessionData } from './types';
import { UUCrypto } from './uuCrypto';

class FakeCrypto extends UUCrypto {
  override encryptImmediately(input: string): string {
    return `ENC(${input})`;
  }
}

interface FakeAccount {
  id: AccountId;
  username: string;
  password: string | null;
  deleted: boolean;
}

/** Mirrors the legacy AccountCredentialsStore semantics (soft delete, active pointer). */
class FakeAccounts implements HunguAccountRepository {
  readonly rows: FakeAccount[] = [];

  constructor(private readonly sessions: InMemorySessionStore<HunguSession>) {}

  add(username: string, password: string | null): AccountId {
    const id = this.rows.length + 1;
    this.rows.push({ id, username, password, deleted: false });

    return id;
  }

  get active(): AccountId | null {
    return this.sessions.activeAccountId;
  }

  set active(id: AccountId | null) {
    this.sessions.activeAccountId = id;
  }

  async get(accountId?: AccountId): Promise<AccountCredentials | null> {
    const row = this.find(accountId ?? this.active);

    return row === undefined || row.password === null
      ? null
      : { username: row.username, password: row.password };
  }

  async put(
    credentials: AccountCredentials,
    accountId?: AccountId,
  ): Promise<void> {
    if (accountId === undefined) {
      await this.upsert(credentials);
    }
  }

  async upsert(credentials: AccountCredentials): Promise<AccountId> {
    const username = credentials.username.trim();
    let row = this.rows.find((candidate) => candidate.username === username);

    if (row === undefined) {
      row = {
        id: this.rows.length + 1,
        username,
        password: null,
        deleted: false,
      };
      this.rows.push(row);
    }

    row.password = credentials.password;
    row.deleted = false;
    this.active = row.id;

    return row.id;
  }

  async forget(
    accountId?: AccountId,
    clearActiveProfile = true,
  ): Promise<void> {
    const row = this.find(accountId ?? this.active);

    if (row === undefined) {
      return;
    }

    const wasActive = this.active === row.id;
    row.password = null;
    row.deleted = true;
    await this.sessions.clear(row.id);

    if (wasActive && clearActiveProfile) {
      this.active = null;
    }
  }

  async all(): Promise<Array<{ username: string }>> {
    return this.rows.filter((row) => !row.deleted);
  }

  private find(id: AccountId | null): FakeAccount | undefined {
    return this.rows.find((row) => row.id === id && !row.deleted);
  }
}

const loginSuccess = (ticket: string, realname = '測試學生') => ({
  code: 0,
  message: 'success',
  data: {
    session_data: { ticket },
    idx_data: { session_idx: `idx-${ticket}` },
    login_data: { realname },
    cookie_data: { WM: `cookie-${ticket}` },
  },
});

const profileOk = (username: string) => ({
  code: 0,
  message: 'success',
  data: { username, realname: '測試學生', picture: '' },
});

const invalidAccount = { code: 403, message: 'invalid account', data: [] };

function setup(options: {
  login: FakeResponder;
  profile?: FakeResponder;
  other?: FakeResponder;
  afterRememberedLogin?: (accountId: AccountId | null) => Promise<void>;
}) {
  const sessions = new InMemorySessionStore<HunguSession>(null);
  const accounts = new FakeAccounts(sessions);
  const fake = createFakeFetch([
    [
      'https://uu.nou.edu.tw/',
      { body: '<html/>', setCookies: ['PHPSESSID=home; path=/'] },
    ],
    [
      'https://uu.nou.edu.tw/learn/index.php',
      { body: '<html/>', setCookies: ['WMSESSID=learn; path=/'] },
    ],
    ['https://alt-uu-staging.binota.org/*', { body: invalidAccount }],
    ['https://uu.nou.edu.tw/xmlapi/index.php?action=login*', options.login],
    [
      'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*',
      options.profile ?? { body: profileOk('s1234567') },
    ],
    ['*', options.other ?? { body: { code: 0, data: [] } }],
  ]);
  const services = createHunguServices({
    fetch: fake.fetch,
    config: defaultHunguConfig,
    sessionStore: sessions,
    accounts,
    activeAccount: {
      currentAccountId: async () => sessions.activeAccountId,
    },
    crypto: new FakeCrypto(),
    afterRememberedLogin: options.afterRememberedLogin,
  });

  return { ...services, sessions, accounts, requests: fake.requests };
}

describe('HunguSessionAuthenticator', () => {
  it('logs in, stores credentials and a session with the remote profile', async () => {
    const { authenticator, sessions, accounts, requests } = setup({
      login: { body: loginSuccess('ticket-a') },
    });

    const result = await authenticator.attemptLogin(' s1234567 ', 'secret');

    expect(result).toEqual({ ok: true, message: '', accountId: 1 });
    expect(accounts.rows[0]).toMatchObject({
      username: 's1234567',
      password: 'secret',
    });
    expect(await sessions.get(1)).toEqual({
      baseUrl: 'https://uu.nou.edu.tw',
      userAgent: defaultHunguConfig.userAgent,
      ticket: 'ticket-a',
      session_idx: 'idx-ticket-a',
      cookies: {
        PHPSESSID: 'home',
        WMSESSID: 'learn',
        WM: 'cookie-ticket-a',
      },
      profile: {
        display_name: '測試學生',
        username: 's1234567',
        picture: '',
        realname: '測試學生',
      },
    });
    expect(requests.at(-1)?.url).toContain('action=my-profile&ticket=ticket-a');
    expect(requests.at(-1)?.headers.cookie).toBe(
      'PHPSESSID=home; WMSESSID=learn; WM=cookie-ticket-a',
    );
  });

  it('returns the upstream message when HUNGU rejects the login', async () => {
    const { authenticator, accounts } = setup({
      login: { body: invalidAccount },
    });

    expect(await authenticator.attemptLogin('s1', 'bad')).toEqual({
      ok: false,
      message: 'invalid account',
      raw: invalidAccount,
    });
    expect(accounts.rows).toHaveLength(0);
  });

  it('falls back to the generic message', async () => {
    const { authenticator } = setup({
      login: { body: '<html>oops</html>' },
    });

    expect(await authenticator.attemptLogin('s1', 'bad')).toMatchObject({
      ok: false,
      message: '登入失敗，請確認帳號密碼。',
    });
  });

  it('refuses a sixth account but lets an existing one log in again', async () => {
    const { authenticator, accounts } = setup({
      login: () => ({ body: loginSuccess('t') }),
    });
    for (const username of ['a1', 'a2', 'a3', 'a4', 'a5']) {
      accounts.add(username, 'p');
    }

    expect(await authenticator.attemptLogin('a6', 'p')).toEqual({
      ok: false,
      message: '最多只能新增 5 個帳號，請先移除其他帳號。',
    });
    expect(await authenticator.attemptLogin('a3', 'p')).toMatchObject({
      ok: true,
      accountId: 3,
    });
  });

  it('routes reviewer usernames to the staging server', async () => {
    const { authenticator, requests } = setup({
      login: { body: loginSuccess('t') },
    });

    await authenticator.attemptLogin('reviewer2', 'p');

    expect(
      requests.every((request) =>
        request.url.startsWith('https://alt-uu-staging.binota.org/'),
      ),
    ).toBe(true);
  });

  it('keeps the login profile when the follow-up profile fetch fails', async () => {
    const { authenticator, sessions } = setup({
      login: { body: loginSuccess('t', '') },
      profile: { body: { code: 500 } },
    });

    await authenticator.attemptLogin('s7', 'p');

    expect(((await sessions.get(1)) as HunguSessionData).profile).toEqual({
      display_name: 's7',
      username: 's7',
      picture: '',
      realname: '',
    });
  });

  // Ported from tests/Unit/UUSessionAuthenticatorTest.php
  it('runs the after-relogin hook (current course sync) when reauthentication succeeds', async () => {
    const afterRememberedLogin = vi.fn(async () => {});
    const { authenticator, accounts } = setup({
      login: { body: loginSuccess('t') },
      afterRememberedLogin,
    });
    accounts.add('s1234567', 'p');
    accounts.active = 1;

    expect(await authenticator.attemptRememberedLogin()).toBe(true);
    expect(afterRememberedLogin).toHaveBeenCalledWith(1);
  });

  it('swallows after-relogin hook errors', async () => {
    const { authenticator, accounts } = setup({
      login: { body: loginSuccess('t') },
      afterRememberedLogin: async () => {
        throw new Error('course sync failed');
      },
    });
    accounts.add('s1234567', 'p');
    accounts.active = 1;

    expect(await authenticator.attemptRememberedLogin()).toBe(true);
  });

  it('soft-deletes the account but keeps it active when remembered login fails', async () => {
    const { authenticator, accounts } = setup({
      login: { body: invalidAccount },
    });
    accounts.add('s1234567', 'wrong-secret');
    accounts.active = 1;

    expect(await authenticator.attemptRememberedLogin()).toBe(false);
    expect(accounts.rows[0].deleted).toBe(true);
    expect(accounts.active).toBe(1);
  });

  it('shares one remembered login between concurrent callers', async () => {
    const { authenticator, accounts, requests } = setup({
      login: { body: loginSuccess('t') },
    });
    accounts.add('s1234567', 'p');
    accounts.active = 1;

    const results = await Promise.all([
      authenticator.attemptRememberedLogin(),
      authenticator.attemptRememberedLogin(),
      authenticator.attemptRememberedLogin(),
    ]);

    expect(results).toEqual([true, true, true]);
    expect(
      requests.filter((request) => request.url.includes('action=login')),
    ).toHaveLength(1);
  });

  it('validates the stored session and clears it when the profile check fails', async () => {
    const { authenticator, sessions } = setup({
      login: { body: invalidAccount },
      profile: [{ body: profileOk('s1') }, { body: { code: 500 } }],
    });
    sessions.activeAccountId = 1;
    await sessions.put({
      baseUrl: 'https://uu.nou.edu.tw',
      userAgent: 'ua',
      cookies: {},
      ticket: 't',
    });

    expect(await authenticator.validateCurrentSession()).toBe(true);
    expect(((await sessions.get()) as HunguSessionData).profile?.username).toBe(
      's1',
    );
    expect(await authenticator.validateCurrentSession()).toBe(false);
    expect(await sessions.get()).toBeNull();
  });

  it('logs out upstream and forgets the account', async () => {
    const { authenticator, accounts, sessions, requests } = setup({
      login: { body: invalidAccount },
    });
    accounts.add('s1', 'p');
    accounts.active = 1;
    await sessions.put({
      baseUrl: 'https://uu.nou.edu.tw',
      userAgent: 'ua',
      cookies: {},
      ticket: 't',
    });

    await authenticator.logout();

    expect(requests.at(-1)).toMatchObject({ method: 'POST' });
    expect(requests.at(-1)?.url).toContain('action=logout');
    expect(await sessions.get(1)).toBeNull();
    expect(accounts.rows[0].deleted).toBe(true);
    expect(accounts.active).toBeNull();
  });
});

// Ported from tests/Feature/Account/AccountReauthenticationTest.php
describe('HUNGU session guard (EnsureHunguSession)', () => {
  it('throws session_invalid with the failed account id when the session and remembered login both fail', async () => {
    const { course, accounts } = setup({ login: { body: invalidAccount } });
    accounts.add('s1234567', 'wrong-secret');
    accounts.active = 1;

    const error = await course
      .fetchCourseList()
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SessionInvalidError);
    expect(error).toMatchObject({
      code: 'session_invalid',
      failedAccountId: 1,
      message: '請先登入課程平台。',
    });
    expect(accounts.active).toBe(1);

    // A later call in the same burst still reports the same account.
    await expect(course.fetchCourseList()).rejects.toMatchObject({
      failedAccountId: 1,
    });
  });

  it('re-logs in transparently when the active account has no session', async () => {
    const { course, accounts, requests } = setup({
      login: { body: loginSuccess('ticket-relogin') },
      other: { body: { code: 0, data: { list: [] } } },
    });
    accounts.add('s1234567', 'secret');
    accounts.active = 1;

    expect(await course.fetchCourseList()).toEqual({
      payload: { code: 0, data: { list: [] } },
    });
    expect(requests.at(-1)?.url).toContain(
      'action=my-course-list&ticket=ticket-relogin',
    );
  });

  it('re-logs in and retries once when HUNGU answers forbidden', async () => {
    const { course, accounts, sessions, requests } = setup({
      login: { body: loginSuccess('fresh') },
      other: [
        { status: 403, body: { code: 1 } },
        { body: { code: 0, data: 'ok' } },
      ],
    });
    accounts.add('s1234567', 'secret');
    accounts.active = 1;
    await sessions.put({
      baseUrl: 'https://uu.nou.edu.tw',
      userAgent: 'ua',
      cookies: { WM: 'stale' },
      ticket: 'stale',
    });

    expect(await course.fetchCourseList()).toEqual({
      payload: { code: 0, data: 'ok' },
    });
    expect(requests.at(-1)?.url).toContain('ticket=fresh');
    expect(requests.at(-1)?.headers.cookie).toContain('WM=cookie-fresh');
  });

  it('never touches another account when one account re-logs in', async () => {
    const { authenticator, accounts, sessions } = setup({
      login: { body: loginSuccess('ticket-a') },
    });
    accounts.add('s1111111', 'secret-a');
    accounts.add('s2222222', 'secret-b');
    await sessions.put(
      {
        baseUrl: 'https://uu.nou.edu.tw',
        userAgent: 'ua',
        cookies: { WM: 'cookie-b' },
        ticket: 'ticket-b',
      },
      2,
    );
    accounts.active = 1;

    expect(await authenticator.attemptRememberedLogin()).toBe(true);
    expect(accounts.active).toBe(1);
    expect(accounts.rows[1]).toMatchObject({
      username: 's2222222',
      deleted: false,
    });
    expect(((await sessions.get(2)) as HunguSessionData).ticket).toBe(
      'ticket-b',
    );
    expect(((await sessions.get(1)) as HunguSessionData).ticket).toBe(
      'ticket-a',
    );
  });

  it('throws for an explicit account without a session instead of re-logging in another', async () => {
    const { course, accounts } = setup({
      login: { body: loginSuccess('t') },
    });
    accounts.add('s1', 'p');
    accounts.active = 1;

    await expect(course.fetchCourseList(1)).rejects.toMatchObject({
      failedAccountId: 1,
    });
  });
});
