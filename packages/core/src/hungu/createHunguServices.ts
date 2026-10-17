import { SessionInvalidError } from '../errors/errors';
import type { UpstreamCallListener } from '../http/transport';
import type { Fetch } from '../platform';
import type {
    AccountId,
    ActiveAccountProvider,
    HunguSession,
    SessionStore,
} from '../session/types';
import type { HunguConfig } from './config';
import {
    HunguCourseClient,
    HunguDiscussClient,
    HunguStudyTimeClient,
} from './hunguApis';
import { HunguClient } from './hunguClient';
import {
    HunguSessionAuthenticator,
    HunguSessionGuard,
    type HunguAccountRepository,
} from './hunguSessionAuthenticator';
import type { UUCrypto } from './uuCrypto';

export interface HunguServicesDeps {
    fetch: Fetch;
    config: HunguConfig;
    sessionStore: SessionStore<HunguSession>;
    accounts: HunguAccountRepository;
    activeAccount: ActiveAccountProvider;
    crypto?: UUCrypto;
    onUpstreamCall?: UpstreamCallListener;
    afterRememberedLogin?: (accountId: AccountId | null) => Promise<void>;
    onError?: (error: unknown) => void;
}

/**
 * Builds the HUNGU client stack and wires it like the legacy service
 * provider: a forbidden response triggers a remembered re-login and one
 * retry, and a request without any stored session for the active account
 * goes through the session guard (remembered login or SessionInvalidError).
 */
export function createHunguServices(deps: HunguServicesDeps) {
    const client = new HunguClient({
        fetch: deps.fetch,
        sessionStore: deps.sessionStore,
        config: deps.config,
        crypto: deps.crypto,
        onUpstreamCall: deps.onUpstreamCall,
    });
    const authenticator = new HunguSessionAuthenticator({
        client,
        sessionStore: deps.sessionStore,
        accounts: deps.accounts,
        activeAccount: deps.activeAccount,
        config: deps.config,
        afterRememberedLogin: deps.afterRememberedLogin,
        onError: deps.onError,
    });
    const guard = new HunguSessionGuard({
        sessionStore: deps.sessionStore,
        authenticator,
        activeAccount: deps.activeAccount,
    });

    client.setReauthenticationHandler(() =>
        authenticator.attemptRememberedLogin(),
    );
    client.setMissingSessionHandler(async (accountId) => {
        if (accountId !== undefined) {
            throw new SessionInvalidError(accountId);
        }

        return guard.ensureSession();
    });

    return {
        client,
        authenticator,
        guard,
        course: new HunguCourseClient(client),
        discuss: new HunguDiscussClient(client),
        studyTime: new HunguStudyTimeClient(client),
    };
}

export type HunguServices = ReturnType<typeof createHunguServices>;
