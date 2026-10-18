/**
 * Contracts shared between the transport layer (http / hungu / school-portal)
 * and the storage layer (db). Ported from the legacy UUSessionStore,
 * SchoolPortalSessionStore, AccountCredentialsStore and AccountContext.
 */

export type AccountId = number;

/** Session state persisted per account (legacy `accounts.hungu_session`). */
export interface HunguSession {
  baseUrl: string;
  userAgent: string;
  /** Cookie name → value, merged from Set-Cookie after every request. */
  cookies: Record<string, string>;
  /** Extra fields the legacy session array carried (profile, etc.). */
  [extra: string]: unknown;
}

/** Session state persisted per account (legacy `accounts.school_portal_session`). */
export interface SchoolPortalSession {
  baseUrl: string;
  userAgent: string;
  cookies: Record<string, string>;
  [extra: string]: unknown;
}

/**
 * Reads and writes one kind of session. `accountId` omitted means the
 * currently active account.
 */
export interface SessionStore<TSession> {
  get(accountId?: AccountId): Promise<TSession | null>;
  put(session: TSession, accountId?: AccountId): Promise<void>;
  clear(accountId?: AccountId): Promise<void>;
}

export interface AccountCredentials {
  username: string;
  password: string;
}

export interface CredentialsStore {
  get(accountId?: AccountId): Promise<AccountCredentials | null>;
  put(credentials: AccountCredentials, accountId?: AccountId): Promise<void>;
}

/** Legacy AccountContext / AccountActiveProfile. */
export interface ActiveAccountProvider {
  currentAccountId(): Promise<AccountId | null>;
}
