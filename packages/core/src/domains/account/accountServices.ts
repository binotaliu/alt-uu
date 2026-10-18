import { eq } from 'drizzle-orm';
import type {
  AccountActiveProfile,
  AccountCredentialsStore,
} from '../../accounts';
import { accounts } from '../../db/schema';
import type { AltUUDatabase } from '../../db/types';
import { dataGet } from '../../http/encoding';
import type { HunguSessionAuthenticator } from '../../hungu';
import type {
  AccountId,
  HunguSession,
  SessionStore,
} from '../../session/types';
import type { AccountOperationResult, AccountViewModel } from './types';
import {
  assertCredentialsInput,
  NotFoundError,
  ValidationError,
} from './validation';

const MAX_ACCOUNTS = 5;
const ACCOUNT_LIMIT_MESSAGE = '最多只能新增 5 個帳號。';
const SESSION_EXPIRED_MESSAGE = '此帳號的登入已失效，請重新輸入密碼。';
const NICKNAME_MAX_LENGTH = 30;

export interface AccountServicesDeps {
  /** Needed to find soft-deleted accounts for re-authentication. */
  db: AltUUDatabase;
  credentials: AccountCredentialsStore;
  activeProfile: AccountActiveProfile;
  hunguSessions: SessionStore<HunguSession>;
  authenticator: Pick<
    HunguSessionAuthenticator,
    'attemptLogin' | 'attemptRememberedLogin'
  >;
  /**
   * Drops the diagnostics request history (legacy ForgetDiagnosticLog).
   * The log is not scoped per account, so removing an account clears all of it.
   */
  forgetDiagnosticLog?: () => Promise<void>;
}

/**
 * ListAccounts, AddAccount, SwitchAccount, ReauthenticateAccount,
 * RenameAccount, RemoveAccount, HasAnyAccounts, with the controller-level
 * validation of the legacy endpoints.
 */
export function createAccountServices(deps: AccountServicesDeps) {
  const { credentials, activeProfile, hunguSessions, authenticator } = deps;

  async function list(): Promise<AccountViewModel[]> {
    const activeId = await activeProfile.get();
    const summaries = await credentials.all();

    return Promise.all(
      summaries.map(async (account): Promise<AccountViewModel> => {
        const session = await hunguSessions.get(account.id);
        const displayName = dataGet(session, 'profile.display_name');
        const picture = dataGet(session, 'profile.picture');

        return {
          id: account.id,
          username: account.username,
          displayName:
            displayName === undefined
              ? account.username
              : stringify(displayName),
          nickname: account.nickname,
          picture: picture === undefined ? '' : stringify(picture),
          isActive: account.id === activeId,
        };
      }),
    );
  }

  async function requireExistingAccount(accountId: AccountId): Promise<void> {
    const found = (await credentials.all()).some(
      (account) => account.id === accountId,
    );

    if (!found) {
      throw new NotFoundError('找不到此帳號。');
    }
  }

  /** Legacy AccountManager::activate (without the Laravel session profile). */
  async function activate(accountId: AccountId): Promise<boolean> {
    await activeProfile.set(accountId);

    let session = await hunguSessions.get();

    if (session === null && (await authenticator.attemptRememberedLogin())) {
      session = await hunguSessions.get();
    }

    return session !== null;
  }

  async function succeeded(): Promise<AccountOperationResult> {
    return { ok: true, message: '', accounts: await list() };
  }

  return {
    list,

    async hasAny(): Promise<boolean> {
      return (await credentials.all()).length > 0;
    },

    async add(input: {
      username: string;
      password: string;
    }): Promise<AccountOperationResult> {
      const username = input.username.trim();
      assertCredentialsInput({ username, password: input.password });

      if ((await credentials.all()).length >= MAX_ACCOUNTS) {
        return { ok: false, message: ACCOUNT_LIMIT_MESSAGE };
      }

      const result = await authenticator.attemptLogin(username, input.password);

      return result.ok ? succeeded() : { ok: false, message: result.message };
    },

    async switchTo(accountId: AccountId): Promise<AccountOperationResult> {
      await requireExistingAccount(accountId);

      const activated = await activate(accountId);
      const accountList = await list();

      return activated
        ? { ok: true, message: '', accounts: accountList }
        : {
            ok: false,
            message: SESSION_EXPIRED_MESSAGE,
            accounts: accountList,
          };
    },

    /**
     * Includes soft-deleted accounts: a session that fails its remembered
     * re-login is soft-deleted before the user can offer a password.
     */
    async reauthenticate(
      accountId: AccountId,
      password: string,
    ): Promise<AccountOperationResult> {
      if (password === '') {
        throw ValidationError.field('password', '請輸入密碼。');
      }

      assertMaxLength('password', password, 191);

      const rows = await deps.db
        .select({ username: accounts.username })
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .limit(1);

      if (rows[0] === undefined) {
        throw new NotFoundError('找不到此帳號。');
      }

      const result = await authenticator.attemptLogin(
        rows[0].username,
        password,
      );

      return result.ok ? succeeded() : { ok: false, message: result.message };
    },

    async rename(
      accountId: AccountId,
      nickname: string | null,
    ): Promise<AccountViewModel[]> {
      await requireExistingAccount(accountId);

      const trimmed = nickname === null ? null : nickname.trim();

      if (trimmed !== null && [...trimmed].length > NICKNAME_MAX_LENGTH) {
        throw ValidationError.field(
          'nickname',
          '自訂名稱長度不可超過 30 個字。',
        );
      }

      await credentials.setNickname(accountId, trimmed ?? '');

      return list();
    },

    /**
     * Forgets the account. When it was the active one the first remaining
     * account (oldest) becomes active, which may itself fail to restore a
     * session; the caller sees that through `list()`.
     */
    async remove(accountId: AccountId): Promise<AccountViewModel[]> {
      await requireExistingAccount(accountId);

      const wasActive = (await activeProfile.get()) === accountId;
      await credentials.forget(accountId);
      await deps.forgetDiagnosticLog?.();

      if (wasActive) {
        const next = (await credentials.all())[0];

        if (next !== undefined) {
          await activate(next.id);
        }
      }

      return list();
    },
  };
}

export type AccountServices = ReturnType<typeof createAccountServices>;

function assertMaxLength(field: string, value: string, max: number): void {
  if ([...value].length > max) {
    throw ValidationError.field(field, `${field} 不可超過 ${max} 個字元。`);
  }
}

function stringify(value: unknown): string {
  return value === null || typeof value === 'object' ? '' : String(value);
}
