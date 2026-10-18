import type {
  AccountActiveProfile,
  AccountCredentialsStore,
} from '../../accounts';
import type { CacheRepository } from '../../db/cache';
import { SessionInvalidError } from '../../errors/errors';
import { dataGet } from '../../http/encoding';
import type { HunguSessionAuthenticator } from '../../hungu';
import type { HunguSession, SessionStore } from '../../session/types';
import { assertCredentialsInput } from '../account/validation';
import type {
  BootstrapSessionResult,
  LoginOutcome,
  SessionProfileViewModel,
} from './types';

const WRONG_CREDENTIALS_MESSAGE = '登入失敗，請確認帳號密碼。';
const LOGIN_RETRY_MESSAGE = '登入失敗，請稍後再試。';

export interface AuthServicesDeps {
  authenticator: Pick<
    HunguSessionAuthenticator,
    | 'attemptLogin'
    | 'attemptRememberedLogin'
    | 'validateCurrentSession'
    | 'logout'
  >;
  hunguSessions: SessionStore<HunguSession>;
  credentials: AccountCredentialsStore;
  activeProfile: AccountActiveProfile;
  cache: CacheRepository;
  /** Reads the `preference:nou-tools-integration` flag (app-preference domain). */
  getNouToolsIntegrationEnabled: () => Promise<boolean>;
  /**
   * Legacy ForgetDiagnosticLog. Logout also closes any open recording
   * window, since the device may change hands.
   */
  forgetDiagnosticLog?: (options: { stopRecording: boolean }) => Promise<void>;
}

/** Login, Logout, BootstrapSession and GetSessionProfile. */
export function createAuthServices(deps: AuthServicesDeps) {
  const { authenticator, hunguSessions } = deps;

  return {
    async login(input: {
      username: string;
      password: string;
    }): Promise<LoginOutcome> {
      const username = input.username.trim();
      assertCredentialsInput({ username, password: input.password });

      const result = await authenticator.attemptLogin(username, input.password);

      if (result.ok) {
        return { ok: true };
      }

      return {
        ok: false,
        message: mapFailedLoginMessage(result.message),
        raw: result.raw,
      };
    },

    /** Signs the active account out and wipes every cached response. */
    async logout(): Promise<{ ok: true }> {
      try {
        await authenticator.logout();
      } finally {
        await deps.cache.flush();
        await deps.forgetDiagnosticLog?.({ stopRecording: true });
      }

      return { ok: true };
    },

    /**
     * Run once at launch: validates the stored session, then falls back to
     * a remembered login. Never throws for an invalid session.
     */
    async bootstrapSession(): Promise<BootstrapSessionResult> {
      let valid = false;

      if ((await hunguSessions.get()) !== null) {
        valid = await authenticator.validateCurrentSession();
      }

      if (!valid) {
        valid = await authenticator.attemptRememberedLogin();
      }

      return {
        ok: true,
        authenticated: valid,
        redirect: valid ? '/courses' : '/login',
        nouToolsIntegrationEnabled: await deps.getNouToolsIntegrationEnabled(),
      };
    },

    /** Throws SessionInvalidError when no account has a session. */
    async getSessionProfile(): Promise<SessionProfileViewModel> {
      const activeAccountId = await deps.activeProfile.get();
      const session = await hunguSessions.get();

      if (session === null) {
        throw new SessionInvalidError(activeAccountId);
      }

      const accounts = await deps.credentials.all();
      const nickname =
        accounts.find((account) => account.id === activeAccountId)?.nickname ??
        null;

      return {
        displayName: stringOrNull(dataGet(session, 'profile.display_name')),
        nickname,
        picture: stringOrNull(dataGet(session, 'profile.picture')),
        username: stringOrNull(dataGet(session, 'profile.username')),
      };
    },
  };
}

export type AuthServices = ReturnType<typeof createAuthServices>;

function mapFailedLoginMessage(sourceMessage: string | null): string {
  switch (sourceMessage) {
    case 'Auth fail::loginType:wm':
    case 'Auth fail':
      return WRONG_CREDENTIALS_MESSAGE;
    default:
      return LOGIN_RETRY_MESSAGE;
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
