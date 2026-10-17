import type { UpstreamCallListener } from '../http/transport';
import type { Fetch } from '../platform';
import type {
    CredentialsStore,
    SchoolPortalSession,
    SessionStore,
} from '../session/types';
import type { SchoolPortalConfig } from './config';
import {
    SchoolPortalClient,
    SchoolPortalSessionAuthenticator,
} from './schoolPortalClient';
import { SchoolPortalProxyClient } from './schoolPortalProxyClient';

/** Builds and wires the school portal stack (re-login on a login page). */
export function createSchoolPortalServices(deps: {
    fetch: Fetch;
    config: SchoolPortalConfig;
    sessionStore: SessionStore<SchoolPortalSession>;
    credentialsStore: CredentialsStore;
    onUpstreamCall?: UpstreamCallListener;
}) {
    const proxy = new SchoolPortalProxyClient(deps);
    const authenticator = new SchoolPortalSessionAuthenticator({
        proxy,
        credentialsStore: deps.credentialsStore,
    });

    proxy.setReauthenticationHandler(() =>
        authenticator.attemptRememberedLogin(),
    );

    return { proxy, authenticator, client: new SchoolPortalClient(proxy) };
}

export type SchoolPortalServices = ReturnType<
    typeof createSchoolPortalServices
>;
