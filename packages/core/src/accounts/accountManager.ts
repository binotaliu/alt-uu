import type { AccountId, HunguSession, SessionStore } from '../session/types';
import type { AccountActiveProfile } from './activeProfile';
import type {
  AccountCredentialsStore,
  AccountSummary,
} from './credentialsStore';

/** Wired by the transport layer (UUSessionAuthenticator) at app start. */
export interface AccountManagerHooks {
  /** Legacy `attemptRememberedLogin`: re-login using stored credentials. */
  attemptRememberedLogin(): Promise<boolean>;
  /** Legacy `attemptLogin`. */
  attemptLogin?(
    username: string,
    password: string,
  ): Promise<{ ok: boolean; message: string }>;
}

/** Port of legacy AccountManager (profile display state is app-layer). */
export class AccountManager {
  private hooks: AccountManagerHooks | null = null;

  constructor(
    private readonly credentialsStore: AccountCredentialsStore,
    private readonly activeProfile: AccountActiveProfile,
    private readonly sessionStore: SessionStore<HunguSession>,
  ) {}

  setHooks(hooks: AccountManagerHooks): void {
    this.hooks = hooks;
  }

  all(): Promise<AccountSummary[]> {
    return this.credentialsStore.all();
  }

  async count(): Promise<number> {
    return (await this.credentialsStore.all()).length;
  }

  activeId(): Promise<AccountId | null> {
    return this.activeProfile.get();
  }

  async attemptLogin(
    username: string,
    password: string,
  ): Promise<{ ok: boolean; message: string }> {
    if (this.hooks?.attemptLogin === undefined) {
      throw new Error('AccountManager login hook is not wired.');
    }

    return this.hooks.attemptLogin(username, password);
  }

  forget(accountId: AccountId): Promise<void> {
    return this.credentialsStore.forget(accountId);
  }

  /**
   * Makes the account active and ensures a valid HUNGU session exists,
   * trying a remembered login when none is stored. Returns false when
   * the session could not be established (caller asks for the password).
   */
  async activate(accountId: AccountId): Promise<boolean> {
    await this.activeProfile.set(accountId);

    if ((await this.sessionStore.get()) !== null) {
      return true;
    }

    if (this.hooks !== null && (await this.hooks.attemptRememberedLogin())) {
      return (await this.sessionStore.get()) !== null;
    }

    return false;
  }
}
