import { applySetCookies, cookieHeader, type CookieJar } from '../http/cookies';
import {
    dataGet,
    decodeHtmlEntities,
    decodeJson,
    httpBuildQuery,
} from '../http/encoding';
import {
    HttpTransport,
    type HttpResponse,
    type UpstreamCallListener,
} from '../http/transport';
import type { Fetch } from '../platform';
import type {
    AccountId,
    CredentialsStore,
    SchoolPortalSession,
    SessionStore,
} from '../session/types';
import { resolveSchoolPortalBaseUrl, type SchoolPortalConfig } from './config';

const HTML_ACCEPT =
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

export interface SchoolPortalPageResult {
    status: number;
    body: string;
}

export interface SchoolPortalFetchHandoff {
    url: string;
    headers: Record<string, string>;
    baseUrl: string;
    cookies: Record<string, string>;
}

export interface SchoolPortalProxyClientDeps {
    fetch: Fetch;
    sessionStore: SessionStore<SchoolPortalSession>;
    credentialsStore: CredentialsStore;
    config: SchoolPortalConfig;
    onUpstreamCall?: UpstreamCallListener;
    timeoutMs?: number;
    now?: () => number;
}

/**
 * Port of legacy SchoolPortalProxyClient (nouapp.nou.edu.tw): form login
 * with the anti-CSRF token, then HTML page fetches with the stored cookie
 * jar. A page that renders the login form triggers one re-login + retry.
 */
export class SchoolPortalProxyClient {
    private readonly transport: HttpTransport;
    private reauthenticationHandler: (() => Promise<boolean>) | null = null;

    constructor(private readonly deps: SchoolPortalProxyClientDeps) {
        this.transport = new HttpTransport({
            fetch: deps.fetch,
            service: 'school-portal',
            timeoutMs: deps.timeoutMs,
            onUpstreamCall: deps.onUpstreamCall,
            now: deps.now,
        });
    }

    setReauthenticationHandler(handler: (() => Promise<boolean>) | null): void {
        this.reauthenticationHandler = handler;
    }

    /** Logs in and stores the session; resolves false when rejected. */
    async login(
        username: string,
        password: string,
        accountId?: AccountId,
    ): Promise<boolean> {
        const baseUrl = normalizeBaseUrl(
            resolveSchoolPortalBaseUrl(this.deps.config, username),
        );
        const userAgent = this.deps.config.userAgent;
        const loginUrl = `${baseUrl}/device/compliant/login/login`;

        const loginPage = await this.send(
            baseUrl,
            userAgent,
            {},
            {
                method: 'GET',
                url: `${loginUrl}?authority=nou`,
                accept: HTML_ACCEPT,
            },
        );
        let cookies = applySetCookies({}, loginPage.setCookies, this.nowDate());
        const anticsrf = extractAnticsrf(loginPage.body);

        // The session cookie arrives on the 302, so redirects must not be followed.
        const loginResponse = await this.send(baseUrl, userAgent, cookies, {
            method: 'POST',
            url: loginUrl,
            contentType: 'application/x-www-form-urlencoded',
            body: httpBuildQuery({
                startOver: 1,
                anticsrf,
                authority: 'nou',
                loginUser: username.trim(),
                loginPassword: password,
                agreeTerm: 1,
            }),
            followRedirects: false,
        });
        cookies = applySetCookies(
            cookies,
            loginResponse.setCookies,
            this.nowDate(),
        );

        const sessionCheck = await this.send(baseUrl, userAgent, cookies, {
            method: 'GET',
            url: `${baseUrl}/rest/login/session`,
            accept: 'application/json',
            expectsJson: true,
        });
        cookies = applySetCookies(
            cookies,
            sessionCheck.setCookies,
            this.nowDate(),
        );

        const userId = dataGet(
            decodeJson(sessionCheck.body),
            'response.user.userID',
        );

        if (userId === undefined || userId === null || userId === '') {
            return false;
        }

        await this.syncSession({ baseUrl, userAgent, cookies }, accountId);

        return true;
    }

    async fetchHtmlPage(
        path: string,
        canRetryOnFailure = true,
        accountId?: AccountId,
    ): Promise<SchoolPortalPageResult> {
        const session = await this.deps.sessionStore.get(accountId);
        const baseUrl = normalizeBaseUrl(
            session?.baseUrl || (await this.rememberedBaseUrl(accountId)),
        );
        const userAgent = session?.userAgent || this.deps.config.userAgent;
        const cookies = session?.cookies ?? {};

        const response = await this.send(baseUrl, userAgent, cookies, {
            method: 'GET',
            url: `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`,
            accept: HTML_ACCEPT,
        });

        await this.syncSession(
            {
                ...(session ?? {}),
                baseUrl,
                userAgent,
                cookies: applySetCookies(
                    cookies,
                    response.setCookies,
                    this.nowDate(),
                ),
            },
            accountId,
        );

        if (
            canRetryOnFailure &&
            looksLikeLoginPage(response.body) &&
            (await this.reauthenticate())
        ) {
            return this.fetchHtmlPage(path, false, accountId);
        }

        return { status: response.status, body: response.body };
    }

    /** Request for the attachment bridge (replaces legacy downloadToLocalDisk). */
    async downloadHandoff(
        url: string,
        accountId?: AccountId,
    ): Promise<SchoolPortalFetchHandoff> {
        const session = await this.deps.sessionStore.get(accountId);
        const baseUrl = normalizeBaseUrl(
            session?.baseUrl || (await this.rememberedBaseUrl(accountId)),
        );
        const userAgent = session?.userAgent || this.deps.config.userAgent;
        const cookies = { ...(session?.cookies ?? {}) };

        return {
            url,
            headers: {
                ...baseHeaders(baseUrl, userAgent, cookies),
                accept: '*/*',
            },
            baseUrl,
            cookies,
        };
    }

    async hasSession(accountId?: AccountId): Promise<boolean> {
        return (await this.deps.sessionStore.get(accountId)) !== null;
    }

    async syncSession(
        session: SchoolPortalSession,
        accountId?: AccountId,
    ): Promise<void> {
        if (Object.keys(session).length === 0) {
            return;
        }

        await this.deps.sessionStore.put(session, accountId);
    }

    private async rememberedBaseUrl(accountId?: AccountId): Promise<string> {
        const credentials = await this.deps.credentialsStore.get(accountId);

        return resolveSchoolPortalBaseUrl(
            this.deps.config,
            credentials?.username ?? '',
        );
    }

    private send(
        baseUrl: string,
        userAgent: string,
        cookies: CookieJar,
        request: {
            method: string;
            url: string;
            accept?: string;
            contentType?: string;
            body?: string;
            followRedirects?: boolean;
            expectsJson?: boolean;
        },
    ): Promise<HttpResponse> {
        const headers = baseHeaders(baseUrl, userAgent, {});

        if (request.accept !== undefined) {
            headers.accept = request.accept;
        }

        if (request.contentType !== undefined) {
            headers['content-type'] = request.contentType;
        }

        return this.transport.send({
            method: request.method,
            url: request.url,
            headers,
            cookies,
            body: request.body ?? null,
            followRedirects: request.followRedirects ?? true,
            expectsJson: request.expectsJson ?? false,
        });
    }

    private async reauthenticate(): Promise<boolean> {
        if (this.reauthenticationHandler === null) {
            return false;
        }

        try {
            return await this.reauthenticationHandler();
        } catch {
            return false;
        }
    }

    private nowDate(): Date {
        return new Date((this.deps.now ?? Date.now)());
    }
}

function baseHeaders(
    baseUrl: string,
    userAgent: string,
    cookies: CookieJar,
): Record<string, string> {
    const origin = baseUrl.replace(/\/+$/, '');
    const headers: Record<string, string> = {
        'user-agent': userAgent,
        origin,
        referer: `${origin}/device/compliant/home/`,
    };
    const cookie = cookieHeader(cookies);

    if (cookie !== '') {
        headers.cookie = cookie;
    }

    return headers;
}

function normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.trim().replace(/\/+$/, '');
}

/** Value of the first `<input name="anticsrf">`, entity-decoded. */
export function extractAnticsrf(html: string): string {
    for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
        const attributes = parseAttributes(match[0]);

        if (attributes.name === 'anticsrf') {
            return decodeHtmlEntities(attributes.value ?? '');
        }
    }

    return '';
}

function parseAttributes(tag: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    const pattern =
        /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

    for (const match of tag.replace(/^<input/i, '').matchAll(pattern)) {
        const name = match[1].toLowerCase();

        if (!(name in attributes)) {
            attributes[name] = match[2] ?? match[3] ?? match[4] ?? '';
        }
    }

    return attributes;
}

function looksLikeLoginPage(html: string): boolean {
    return html !== '' && html.includes('name="loginUser"');
}
