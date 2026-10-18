import { SessionInvalidError } from '../errors/errors';
import { dataGet } from '../http/encoding';
import type {
  AccountCredentials,
  AccountId,
  ActiveAccountProvider,
  CredentialsStore,
  HunguSession,
  SessionStore,
} from '../session/types';
import { resolveHunguBaseUrl, type HunguConfig } from './config';
import type { HunguClient } from './hunguClient';
import { normalizeHunguProfile } from './profile';
import type { HunguPayload, HunguSessionData } from './types';

export const MAX_ACCOUNTS = 5;
export const LOGIN_FAILED_MESSAGE = '登入失敗，請確認帳號密碼。';
export const MAX_ACCOUNTS_MESSAGE = '最多只能新增 5 個帳號，請先移除其他帳號。';

/**
 * The account operations the authenticator needs. The storage layer's
 * AccountCredentialsStore satisfies this structurally.
 */
export interface HunguAccountRepository extends CredentialsStore {
  /** Creates or restores the account by trimmed username and makes it active. */
  upsert(credentials: AccountCredentials): Promise<AccountId>;
  /** Soft-deletes the account and wipes its secrets and sessions. */
  forget(accountId?: AccountId, clearActiveProfile?: boolean): Promise<void>;
  /** Non-deleted accounts. */
  all(): Promise<Array<{ username: string }>>;
}

export type HunguLoginResult =
  | { ok: true; message: ''; accountId: AccountId }
  | { ok: false; message: string; raw?: HunguPayload };

export interface HunguSessionAuthenticatorDeps {
  client: HunguClient;
  sessionStore: SessionStore<HunguSession>;
  accounts: HunguAccountRepository;
  activeAccount: ActiveAccountProvider;
  config: HunguConfig;
  /**
   * Runs after a successful remembered re-login, e.g. to re-enter the
   * current course (legacy SyncCurrentCourse with force). Errors are
   * swallowed like the legacy `report($e)`.
   */
  afterRememberedLogin?: (accountId: AccountId | null) => Promise<void>;
  onError?: (error: unknown) => void;
}

/**
 * Port of legacy UUSessionAuthenticator (+ UUAuthClient::logout): login,
 * profile refresh, session validation and remembered re-login.
 */
export class HunguSessionAuthenticator {
  private readonly rememberedLogins = new Map<string, Promise<boolean>>();

  constructor(private readonly deps: HunguSessionAuthenticatorDeps) {}

  async attemptLogin(
    username: string,
    password: string,
  ): Promise<HunguLoginResult> {
    const { client, config, accounts } = this.deps;
    const normalizedUsername = username.trim();
    const baseUrl = resolveHunguBaseUrl(config, normalizedUsername);
    const userAgent = config.userAgent;

    const result = await client.login(
      baseUrl,
      userAgent,
      normalizedUsername,
      password,
    );
    const payload = result.payload;

    if ((payload.code ?? 500) !== 0) {
      return {
        ok: false,
        message: String(payload.message ?? LOGIN_FAILED_MESSAGE),
        raw: payload,
      };
    }

    const existing = await accounts.all();

    if (
      !existing.some((account) => account.username === normalizedUsername) &&
      existing.length >= MAX_ACCOUNTS
    ) {
      return { ok: false, message: MAX_ACCOUNTS_MESSAGE };
    }

    const session: HunguSessionData = {
      baseUrl,
      userAgent,
      ticket: stringOr(dataGet(payload, 'data.session_data.ticket')),
      session_idx: stringOr(dataGet(payload, 'data.idx_data.session_idx')),
      cookies: result.cookies,
      profile: normalizeHunguProfile(
        dataGet(payload, 'data.login_data'),
        normalizedUsername,
      ) ?? {
        display_name: normalizedUsername,
        username: normalizedUsername,
        picture: '',
        realname: '',
      },
    };

    const accountId = await accounts.upsert({
      username: normalizedUsername,
      password,
    });

    await client.syncSession(session, accountId);
    await this.refreshProfileFromRemote(session, false, accountId);

    return { ok: true, message: '', accountId };
  }

  /** Checks the stored session with `my-profile`; clears it when invalid. */
  async validateCurrentSession(accountId?: AccountId): Promise<boolean> {
    const session = await this.deps.sessionStore.get(accountId);

    if (session === null) {
      return false;
    }

    return (
      (await this.refreshProfileFromRemote(
        session as HunguSessionData,
        true,
        accountId,
        true,
      )) !== null
    );
  }

  /**
   * Re-logs the active account in with its stored credentials. On failure
   * the account is soft-deleted but stays the active profile, so callers
   * can still report which account failed. Concurrent calls for the same
   * account share one attempt.
   */
  async attemptRememberedLogin(): Promise<boolean> {
    const accountId = await this.deps.activeAccount.currentAccountId();
    const key = String(accountId);
    const inFlight = this.rememberedLogins.get(key);

    if (inFlight !== undefined) {
      return inFlight;
    }

    const attempt = this.performRememberedLogin(accountId).finally(() => {
      this.rememberedLogins.delete(key);
    });
    this.rememberedLogins.set(key, attempt);

    return attempt;
  }

  /** Legacy UUAuthClient::logout. */
  async logout(): Promise<void> {
    await this.deps.client.request('logout', { method: 'POST' });
    await this.deps.sessionStore.clear();
    await this.deps.accounts.forget();
  }

  private async performRememberedLogin(
    accountId: AccountId | null,
  ): Promise<boolean> {
    const credentials = await this.deps.accounts.get();

    if (credentials === null) {
      return false;
    }

    const result = await this.attemptLogin(
      credentials.username,
      credentials.password,
    );

    if (!result.ok) {
      await this.deps.accounts.forget(undefined, false);

      return false;
    }

    if (this.deps.afterRememberedLogin !== undefined) {
      try {
        await this.deps.afterRememberedLogin(accountId);
      } catch (error) {
        this.deps.onError?.(error);
      }
    }

    return true;
  }

  /**
   * Fetches `my-profile` and stores the normalised profile on the latest
   * session. After a fresh login the request must not retry on forbidden:
   * the retry would start another remembered login from inside this one.
   */
  private async refreshProfileFromRemote(
    session: HunguSessionData,
    invalidateOnFailure: boolean,
    accountId?: AccountId,
    canRetryOnForbidden = false,
  ): Promise<HunguSessionData | null> {
    const { client, sessionStore } = this.deps;
    const { payload } = await client.request('my-profile', {
      accountId,
      canRetryOnForbidden,
    });

    const profile =
      (payload.code ?? 500) === 0
        ? normalizeHunguProfile(
            payload.data,
            stringOr(dataGet(session, 'profile.username')),
          )
        : null;

    if (profile === null) {
      if (invalidateOnFailure) {
        await sessionStore.clear(accountId);
      }

      return null;
    }

    const latest = ((await sessionStore.get(accountId)) ??
      session) as HunguSessionData;
    const updated: HunguSessionData = { ...latest, profile };
    await client.syncSession(updated, accountId);

    return updated;
  }
}

/**
 * Port of the legacy EnsureHunguSession middleware: returns the active
 * account's session, re-logging in with remembered credentials when there is
 * none, or throws SessionInvalidError naming the account that was active.
 * (The web-only boot-validation cookie is replaced by the app calling
 * `validateCurrentSession` once at launch.)
 */
export class HunguSessionGuard {
  constructor(
    private readonly deps: {
      sessionStore: SessionStore<HunguSession>;
      authenticator: Pick<HunguSessionAuthenticator, 'attemptRememberedLogin'>;
      activeAccount: ActiveAccountProvider;
    },
  ) {}

  async ensureSession(): Promise<HunguSessionData> {
    // Read first: a failed remembered login soft-deletes the account.
    const attemptedAccountId = await this.deps.activeAccount.currentAccountId();
    let session = await this.deps.sessionStore.get();

    if (
      session === null &&
      (await this.deps.authenticator.attemptRememberedLogin())
    ) {
      session = await this.deps.sessionStore.get();
    }

    if (session === null) {
      throw new SessionInvalidError(attemptedAccountId);
    }

    return session as HunguSessionData;
  }
}

function stringOr(value: unknown): string {
  return value === undefined || value === null || typeof value === 'object'
    ? ''
    : String(value);
}
