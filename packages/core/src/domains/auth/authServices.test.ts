import { describe, expect, it, vi } from 'vitest';
import { cache } from '../../db/schema';
import { SessionInvalidError } from '../../errors/errors';
import {
  createHarness,
  invalidAccount,
  loginSuccess,
  profileOk,
  warmUpRoutes,
  type Harness,
} from '../account/testing';
import { createAuthServices } from './index';

function services(
  harness: Harness,
  overrides: {
    nouTools?: boolean;
    forgetDiagnosticLog?: (options: {
      stopRecording: boolean;
    }) => Promise<void>;
  } = {},
) {
  return createAuthServices({
    authenticator: harness.authenticator,
    hunguSessions: harness.hunguSessions,
    credentials: harness.credentials,
    activeProfile: harness.activeProfile,
    cache: harness.cache,
    getNouToolsIntegrationEnabled: async () => overrides.nouTools ?? false,
    forgetDiagnosticLog: overrides.forgetDiagnosticLog,
  });
}

// Ported from tests/Feature/Auth/AuthFlowTest.php
describe('login', () => {
  it('maps a failed login to the user-facing message and keeps the raw payload', async () => {
    const raw = { code: 503, message: 'Auth fail', data: [] };
    const harness = await createHarness([
      ...warmUpRoutes,
      ['https://uu.nou.edu.tw/xmlapi/index.php?action=login*', { body: raw }],
    ]);

    expect(
      await services(harness).login({
        username: 's1234567',
        password: 'wrong-password',
      }),
    ).toEqual({
      ok: false,
      message: '登入失敗，請確認帳號密碼。',
      raw,
    });
  });

  it('uses the retry message for any other failure reason', async () => {
    const harness = await createHarness([
      ...warmUpRoutes,
      [
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*',
        { body: invalidAccount },
      ],
    ]);

    expect(
      await services(harness).login({ username: 's1', password: 'x' }),
    ).toMatchObject({
      ok: false,
      message: '登入失敗，請稍後再試。',
    });
  });

  it('stores the session and remembered credentials after a successful login', async () => {
    const harness = await createHarness([
      ...warmUpRoutes,
      [
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*',
        { body: loginSuccess('ticket-1') },
      ],
      [
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*',
        {
          body: {
            code: 0,
            data: {
              username: 's1234567',
              realname: '測試學生',
              picture: 'https://uu.nou.edu.tw/avatar.jpg',
            },
          },
        },
      ],
    ]);

    expect(
      await services(harness).login({
        username: 's1234567',
        password: 'secret',
      }),
    ).toEqual({ ok: true });

    expect(await harness.credentials.get()).toEqual({
      username: 's1234567',
      password: 'secret',
    });
    expect((await harness.hunguSessions.get())?.profile).toMatchObject({
      username: 's1234567',
      display_name: '測試學生',
      picture: 'https://uu.nou.edu.tw/avatar.jpg',
    });
  });

  it('uses the session ticket, not the idx, when fetching the profile', async () => {
    const harness = await createHarness([
      ...warmUpRoutes,
      [
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*',
        { body: loginSuccess('ticket-from-session-data') },
      ],
      [
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*',
        { body: profileOk('s1234567') },
      ],
    ]);

    await services(harness).login({
      username: 's1234567',
      password: 'secret',
    });

    const profileRequest = harness.requests.find((request) =>
      request.url.includes('action=my-profile'),
    );
    expect(profileRequest?.url).toContain('ticket=ticket-from-session-data');
    expect(profileRequest?.url).not.toContain('idx-ticket');
  });
});

describe('logout', () => {
  it('clears session, account, cache and the diagnostics log even when the request fails', async () => {
    const forgetDiagnosticLog = vi.fn(async () => {});
    const harness = await createHarness([
      [
        'https://uu.nou.edu.tw/xmlapi/index.php?action=logout*',
        { body: { code: 0 } },
      ],
    ]);
    await harness.seedAccount('s1', 'a', true);
    await harness.cache.put('anything', { a: 1 }, 60);

    await services(harness, { forgetDiagnosticLog }).logout();

    expect(await harness.hunguSessions.get()).toBeNull();
    expect(await harness.credentials.all()).toHaveLength(0);
    expect(await harness.db.select().from(cache)).toHaveLength(0);
    expect(forgetDiagnosticLog).toHaveBeenCalledWith({
      stopRecording: true,
    });
  });

  it('still cleans up when the logout request throws', async () => {
    const forgetDiagnosticLog = vi.fn(async () => {});
    const harness = await createHarness([
      [
        'https://uu-a.nou.edu.tw/xmlapi/index.php?action=logout*',
        new Error('offline'),
      ],
    ]);
    await harness.seedAccount('s1', 'a', true);
    await harness.cache.put('anything', 1, 60);

    await expect(
      services(harness, { forgetDiagnosticLog }).logout(),
    ).rejects.toThrow();

    expect(await harness.db.select().from(cache)).toHaveLength(0);
    expect(forgetDiagnosticLog).toHaveBeenCalledOnce();
  });
});

describe('bootstrapSession', () => {
  it('validates an existing session and refreshes the profile', async () => {
    const harness = await createHarness([
      [
        'https://uu-a.nou.edu.tw/xmlapi/index.php?action=my-profile*',
        {
          body: {
            code: 0,
            data: {
              username: 's1234567',
              realname: '新名稱',
              picture: 'https://uu.nou.edu.tw/new-avatar.jpg',
            },
          },
        },
      ],
    ]);
    await harness.seedAccount('s1234567', 'a', true);

    expect(await services(harness).bootstrapSession()).toEqual({
      ok: true,
      authenticated: true,
      redirect: '/courses',
      nouToolsIntegrationEnabled: false,
    });
    expect((await harness.hunguSessions.get())?.profile).toMatchObject({
      display_name: '新名稱',
    });
  });

  it('returns the saved nou tools preference', async () => {
    const harness = await createHarness([
      [
        'https://uu-a.nou.edu.tw/xmlapi/index.php?action=my-profile*',
        { body: profileOk('s1234567') },
      ],
    ]);
    await harness.seedAccount('s1234567', 'a', true);

    expect(
      await services(harness, { nouTools: true }).bootstrapSession(),
    ).toMatchObject({
      redirect: '/courses',
      nouToolsIntegrationEnabled: true,
    });
  });

  it('tries remembered credentials when the current session cannot be validated', async () => {
    const harness = await createHarness([
      ...warmUpRoutes,
      [
        'https://uu-a.nou.edu.tw/xmlapi/index.php?action=my-profile*',
        { body: { code: 503, message: 'Auth fail', data: [] } },
      ],
      [
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*',
        { body: loginSuccess('ticket-relogin') },
      ],
      [
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*',
        {
          body: {
            code: 0,
            data: {
              username: 's1234567',
              realname: '測試學生',
              picture: 'https://uu.nou.edu.tw/avatar.jpg',
            },
          },
        },
      ],
    ]);
    await harness.seedAccount('s1234567', 'a', true);

    const result = await services(harness).bootstrapSession();

    expect(result).toMatchObject({
      authenticated: true,
      redirect: '/courses',
    });
    expect((await harness.hunguSessions.get())?.profile).toMatchObject({
      username: 's1234567',
    });
  });

  it('sends the user to login when validation and remembered login both fail', async () => {
    const harness = await createHarness([
      ...warmUpRoutes,
      [
        'https://uu-a.nou.edu.tw/xmlapi/index.php?action=my-profile*',
        { body: { code: 503, message: 'Auth fail', data: [] } },
      ],
      [
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*',
        { body: invalidAccount },
      ],
    ]);
    await harness.seedAccount('s1234567', 'a', true);

    expect(await services(harness).bootstrapSession()).toMatchObject({
      ok: true,
      authenticated: false,
      redirect: '/login',
    });
  });

  it('goes straight to login without any account', async () => {
    const harness = await createHarness();

    expect(await services(harness).bootstrapSession()).toMatchObject({
      authenticated: false,
      redirect: '/login',
    });
    expect(harness.requests).toHaveLength(0);
  });
});

// Ported from tests/Feature/Auth/SessionProfileControllerTest.php
describe('getSessionProfile', () => {
  it('rejects when there is no session', async () => {
    const harness = await createHarness();

    await expect(services(harness).getSessionProfile()).rejects.toBeInstanceOf(
      SessionInvalidError,
    );
  });

  it('returns the active session profile with the account nickname', async () => {
    const harness = await createHarness();
    const id = await harness.credentials.upsert({
      username: 's1234567',
      password: 'test-password',
    });
    await harness.hunguSessions.put(
      {
        baseUrl: 'https://uu.nou.edu.tw',
        userAgent: 'ua',
        cookies: { WMSESSID: 'cookie-1' },
        ticket: 'ticket-1',
        profile: {
          display_name: '測試學生',
          username: 's1234567',
          picture: 'https://uu.nou.edu.tw/avatar.jpg',
          realname: '測試學生',
        },
      },
      id,
    );
    await harness.credentials.setNickname(id, '暱稱測試');

    expect(await services(harness).getSessionProfile()).toEqual({
      displayName: '測試學生',
      nickname: '暱稱測試',
      picture: 'https://uu.nou.edu.tw/avatar.jpg',
      username: 's1234567',
    });
  });
});
