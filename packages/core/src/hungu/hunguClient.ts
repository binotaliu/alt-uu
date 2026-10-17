import { SessionInvalidError } from '../errors/errors';
import {
    applySetCookies,
    cookieHeader,
    mergeCookies,
    type CookieJar,
} from '../http/cookies';
import {
    dataGet,
    decodeJson,
    httpBuildQuery,
    isRecord,
    phpJsonEncode,
    rawUrlEncode,
    type QueryValue,
} from '../http/encoding';
import {
    HttpTransport,
    type HttpResponse,
    type UpstreamCallListener,
} from '../http/transport';
import type { Fetch } from '../platform';
import type { AccountId, HunguSession, SessionStore } from '../session/types';
import { normalizeHunguBaseUrl, type HunguConfig } from './config';
import type {
    HunguFetchHandoff,
    HunguPageResult,
    HunguPayload,
    HunguPayloadResult,
    HunguSessionData,
} from './types';
import { UUCrypto } from './uuCrypto';

export type HunguBodyType = 'form' | 'json';
export type HunguBody = Record<string, QueryValue> | string | null;

export interface HunguRequestOptions {
    method?: string;
    params?: Record<string, QueryValue>;
    body?: HunguBody;
    bodyType?: HunguBodyType;
    canRetryOnForbidden?: boolean;
    /** Defaults to the active account. */
    accountId?: AccountId;
}

/** Re-login with remembered credentials; resolves true on success. */
export type ReauthenticationHandler = () => Promise<boolean>;

/**
 * Called when the account has no stored session at all. Must resolve to a
 * session (after a remembered re-login) or throw SessionInvalidError.
 */
export type MissingSessionHandler = (
    accountId: AccountId | undefined,
) => Promise<HunguSession>;

export interface HunguClientDeps {
    fetch: Fetch;
    sessionStore: SessionStore<HunguSession>;
    config: HunguConfig;
    crypto?: UUCrypto;
    onUpstreamCall?: UpstreamCallListener;
    timeoutMs?: number;
    now?: () => number;
}

/** Laravel `acceptJson()` + an explicit accept, as Guzzle joined them. */
const JSON_ACCEPT = 'application/json, application/json,text/plain,*/*';
const RAW_ACCEPT = 'application/json, */*';
const HTML_ACCEPT =
    'application/json, text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded; charset=UTF-8';

/**
 * Port of legacy UUProxyClient: talks to HUNGU (uu.nou.edu.tw) xmlapi and
 * pages with the per-account session (ticket + explicit cookie jar), merges
 * Set-Cookie into the stored session after every call and retries once
 * after a forbidden response when a re-login succeeds.
 */
export class HunguClient {
    private readonly transport: HttpTransport;
    private readonly crypto: UUCrypto;
    private reauthenticationHandler: ReauthenticationHandler | null = null;
    private missingSessionHandler: MissingSessionHandler | null = null;

    constructor(private readonly deps: HunguClientDeps) {
        this.crypto = deps.crypto ?? new UUCrypto();
        this.transport = new HttpTransport({
            fetch: deps.fetch,
            service: 'hungu',
            timeoutMs: deps.timeoutMs,
            onUpstreamCall: deps.onUpstreamCall,
            now: deps.now,
        });
    }

    setReauthenticationHandler(handler: ReauthenticationHandler | null): void {
        this.reauthenticationHandler = handler;
    }

    setMissingSessionHandler(handler: MissingSessionHandler | null): void {
        this.missingSessionHandler = handler;
    }

    /** Calls `/xmlapi/index.php?action=…` with the session ticket. */
    async request(
        action: string,
        options: HunguRequestOptions = {},
    ): Promise<HunguPayloadResult> {
        const {
            method = 'GET',
            params = {},
            body = null,
            bodyType = 'form',
            canRetryOnForbidden = true,
            accountId,
        } = options;
        const session = await this.currentSession(accountId);
        const { baseUrl, userAgent } = this.sessionTarget(session);
        const ticket = String(session.ticket || session.session_idx || '');
        const query = withoutEmpty({ ticket, ua: userAgent, ...params });
        const url = `${baseUrl}/xmlapi/index.php?action=${rawUrlEncode(action)}&${httpBuildQuery(query)}`;

        const response = await this.send(session, {
            method,
            url,
            accept: JSON_ACCEPT,
            body,
            bodyType,
        });
        await this.persistCookies(session, response.setCookies, accountId);

        const payload = toPayload(decodeJson(response.body));

        if (
            canRetryOnForbidden &&
            isForbidden(response.status, payload) &&
            (await this.reauthenticate())
        ) {
            return this.request(action, {
                ...options,
                canRetryOnForbidden: false,
            });
        }

        return { payload };
    }

    /** Calls a non-xmlapi endpoint such as `/mooc/controllers/forum_ajax.php`. */
    async requestOnPath(
        path: string,
        options: HunguRequestOptions = {},
    ): Promise<HunguPayloadResult> {
        const {
            method = 'GET',
            params = {},
            body = null,
            bodyType = 'form',
            canRetryOnForbidden = true,
            accountId,
        } = options;
        const session = await this.currentSession(accountId);
        const { baseUrl } = this.sessionTarget(session);
        const query = httpBuildQuery(withoutEmpty({ ...params }));
        const url = `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}${query === '' ? '' : `?${query}`}`;

        const response = await this.send(session, {
            method,
            url,
            accept: JSON_ACCEPT,
            body,
            bodyType,
        });
        await this.persistCookies(session, response.setCookies, accountId);

        if (
            canRetryOnForbidden &&
            response.status === 403 &&
            (await this.reauthenticate())
        ) {
            return this.requestOnPath(path, {
                ...options,
                canRetryOnForbidden: false,
            });
        }

        return { payload: toPayload(decodeJson(response.body)) };
    }

    /**
     * Warms up cookies from `/` and `/learn/index.php`, then logs in. Does
     * not touch the session store; the authenticator persists the result.
     */
    async login(
        rawBaseUrl: string,
        userAgent: string,
        username: string,
        password: string,
    ): Promise<{ payload: HunguPayload; cookies: CookieJar }> {
        const baseUrl = normalizeHunguBaseUrl(rawBaseUrl);
        const cookies = await this.warmupCookies(baseUrl, userAgent);

        const response = await this.transport.send({
            method: 'POST',
            url: `${baseUrl}/xmlapi/index.php?action=login&ua=${rawUrlEncode(userAgent)}`,
            headers: {
                ...baseHeaders(baseUrl, userAgent),
                accept: 'application/json, */*',
                // Laravel sent the JSON body under this form content type.
                'content-type': FORM_CONTENT_TYPE,
            },
            cookies,
            body: phpJsonEncode({
                username: this.crypto.encryptImmediately(username.trim()),
                password: this.crypto.encryptImmediately(password),
                kickOff: !this.deps.config.debug,
            }),
        });

        const payload = toPayload(decodeJson(response.body));
        const cookieData = normalizeCookieData(
            dataGet(payload, 'data.cookie_data'),
        );

        return {
            payload,
            cookies: mergeCookies(
                applySetCookies(cookies, response.setCookies, this.nowDate()),
                cookieData,
            ),
        };
    }

    /** GET a HUNGU page or file as text (legacy fetchMaterialContent). */
    async fetchMaterialContent(
        url: string,
        accountId?: AccountId,
    ): Promise<HunguPageResult> {
        const session = await this.currentSession(accountId);
        const response = await this.send(session, {
            method: 'GET',
            url,
            accept: RAW_ACCEPT,
            expectsJson: false,
        });
        await this.persistCookies(session, response.setCookies, accountId);

        return {
            status: response.status,
            body: response.body,
            headers: {
                'content-type':
                    response.header('content-type') ??
                    'text/plain; charset=utf-8',
            },
        };
    }

    /** HEAD a URL to learn its type and size before downloading. */
    async probeContentType(
        url: string,
        accountId?: AccountId,
    ): Promise<{
        status: number;
        contentType: string;
        contentLength: string | null;
    }> {
        const session = await this.currentSession(accountId);
        const response = await this.send(session, {
            method: 'HEAD',
            url,
            accept: RAW_ACCEPT,
            expectsJson: false,
        });
        await this.persistCookies(session, response.setCookies, accountId);

        const contentLength = response.header('content-length');

        return {
            status: response.status,
            contentType: response.header('content-type') ?? '',
            contentLength:
                contentLength !== null && contentLength.trim() !== ''
                    ? contentLength
                    : null,
        };
    }

    /**
     * The request a native downloader (attachment bridge) or WebView needs
     * to fetch `url` as this user. Replaces the legacy streaming proxy.
     */
    async materialFetchHandoff(
        url: string,
        accountId?: AccountId,
    ): Promise<HunguFetchHandoff> {
        const session = await this.currentSession(accountId);
        const { baseUrl, userAgent } = this.sessionTarget(session);
        const cookies = { ...(session.cookies ?? {}) };
        const headers = Object.fromEntries(
            Object.entries({
                'User-Agent': userAgent,
                Origin: baseUrl,
                Referer: `${baseUrl}/learn/index.php`,
                Cookie: cookieHeader(cookies),
                Accept: '*/*',
            }).filter(([, value]) => value !== ''),
        );

        return { url, headers, baseUrl, cookies };
    }

    async fetchCourseLearningTimePage(
        cid: string,
        accountId?: AccountId,
    ): Promise<HunguPageResult> {
        return this.fetchSessionPage(
            `/learn/last10.php?class_id=${rawUrlEncode(cid)}`,
            accountId,
        );
    }

    async fetchCourseHomeworkPage(
        accountId?: AccountId,
    ): Promise<HunguPageResult> {
        return this.fetchSessionPage(
            '/learn/homework/homework_list.php',
            accountId,
        );
    }

    async fetchCourseSelfExamPage(
        accountId?: AccountId,
    ): Promise<HunguPageResult> {
        return this.fetchSessionPage(
            '/learn/exam/co_self_exam_list.php',
            accountId,
        );
    }

    async fetchPendingHomeworkPage(
        accountId?: AccountId,
    ): Promise<HunguPageResult> {
        return this.fetchSessionPage('/learn/my_homework.php', accountId);
    }

    async fetchUnreadArticlesPage(
        accountId?: AccountId,
    ): Promise<HunguPageResult> {
        return this.fetchSessionPage('/learn/my_forum.php', accountId);
    }

    async fetchCoursePathTree(accountId?: AccountId): Promise<HunguPageResult> {
        return this.fetchSessionPage('/learn/path/pathtree.php', accountId);
    }

    /** Writes a session; an empty object is ignored like the legacy client. */
    async syncSession(
        session: HunguSessionData,
        accountId?: AccountId,
    ): Promise<void> {
        if (Object.keys(session).length === 0) {
            return;
        }

        await this.deps.sessionStore.put(session, accountId);
    }

    async setCookie(
        name: string,
        value: string,
        accountId?: AccountId,
    ): Promise<void> {
        const session = await this.currentSession(accountId);

        await this.syncSession(
            {
                ...session,
                cookies: { ...(session.cookies ?? {}), [name]: value },
            },
            accountId,
        );
    }

    private async fetchSessionPage(
        path: string,
        accountId?: AccountId,
    ): Promise<HunguPageResult> {
        const session = await this.currentSession(accountId);

        return this.fetchMaterialContent(
            `${this.sessionTarget(session).baseUrl}${path}`,
            accountId,
        );
    }

    private async currentSession(
        accountId?: AccountId,
    ): Promise<HunguSessionData> {
        const stored = await this.deps.sessionStore.get(accountId);

        if (stored !== null) {
            return stored as HunguSessionData;
        }

        if (this.missingSessionHandler === null) {
            throw new SessionInvalidError(accountId ?? null);
        }

        return (await this.missingSessionHandler(
            accountId,
        )) as HunguSessionData;
    }

    private sessionTarget(session: HunguSessionData): {
        baseUrl: string;
        userAgent: string;
    } {
        return {
            baseUrl: normalizeHunguBaseUrl(String(session.baseUrl ?? '')),
            userAgent: String(session.userAgent || this.deps.config.userAgent),
        };
    }

    private async send(
        session: HunguSessionData,
        request: {
            method: string;
            url: string;
            accept: string;
            body?: HunguBody;
            bodyType?: HunguBodyType;
            expectsJson?: boolean;
        },
    ): Promise<HttpResponse> {
        const { baseUrl, userAgent } = this.sessionTarget(session);
        const headers: Record<string, string> = {
            ...baseHeaders(baseUrl, userAgent),
            accept: request.accept,
        };
        const body = request.body ?? null;

        if (body !== null) {
            headers['content-type'] =
                request.bodyType === 'json'
                    ? 'application/json'
                    : FORM_CONTENT_TYPE;
        }

        return this.transport.send({
            method: request.method,
            url: request.url,
            headers,
            cookies: session.cookies ?? {},
            body: buildBody(body, request.bodyType ?? 'form'),
            expectsJson: request.expectsJson ?? true,
        });
    }

    /**
     * Merges Set-Cookie into the *latest* stored session, not the snapshot
     * the request started from, so concurrent requests do not overwrite each
     * other. Skipped when the session was cleared or replaced by a re-login
     * meanwhile (its cookies would be stale).
     */
    private async persistCookies(
        snapshot: HunguSessionData,
        setCookies: string[],
        accountId?: AccountId,
    ): Promise<void> {
        if (setCookies.length === 0) {
            return;
        }

        const latest = (await this.deps.sessionStore.get(
            accountId,
        )) as HunguSessionData | null;

        if (
            latest === null ||
            sessionIdentity(latest) !== sessionIdentity(snapshot)
        ) {
            return;
        }

        await this.syncSession(
            {
                ...latest,
                cookies: applySetCookies(
                    latest.cookies ?? {},
                    setCookies,
                    this.nowDate(),
                ),
            },
            accountId,
        );
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

    private async warmupCookies(
        baseUrl: string,
        userAgent: string,
    ): Promise<CookieJar> {
        const home = await this.transport.send({
            method: 'GET',
            url: `${baseUrl}/`,
            headers: {
                ...baseHeaders(baseUrl, userAgent),
                accept: HTML_ACCEPT,
            },
            expectsJson: false,
        });
        const cookies = applySetCookies({}, home.setCookies, this.nowDate());

        const learn = await this.transport.send({
            method: 'GET',
            url: `${baseUrl}/learn/index.php`,
            headers: {
                ...baseHeaders(baseUrl, userAgent),
                accept: HTML_ACCEPT,
            },
            cookies,
            expectsJson: false,
        });

        return applySetCookies(cookies, learn.setCookies, this.nowDate());
    }

    private nowDate(): Date {
        return new Date((this.deps.now ?? Date.now)());
    }
}

function baseHeaders(
    baseUrl: string,
    userAgent: string,
): Record<string, string> {
    const origin = baseUrl.replace(/\/+$/, '');

    return {
        'user-agent': userAgent,
        origin,
        referer: `${origin}/learn/index.php`,
    };
}

function buildBody(body: HunguBody, bodyType: HunguBodyType): string | null {
    if (body === null) {
        return null;
    }

    if (typeof body === 'string') {
        return body;
    }

    return bodyType === 'json' ? phpJsonEncode(body) : httpBuildQuery(body);
}

/** `array_filter(..., fn ($v) => ! in_array($v, [null, ''], true))` */
function withoutEmpty(
    values: Record<string, QueryValue>,
): Record<string, QueryValue> {
    return Object.fromEntries(
        Object.entries(values).filter(
            ([, value]) =>
                value !== null && value !== undefined && value !== '',
        ),
    );
}

function toPayload(decoded: unknown): HunguPayload {
    return isRecord(decoded) ? decoded : {};
}

function isForbidden(status: number, payload: HunguPayload): boolean {
    const message = payload.message;

    return (
        status === 403 ||
        payload.code === 403 ||
        payload.code === 1 ||
        (typeof message === 'string' &&
            message.toLowerCase().includes('access denied'))
    );
}

/** Legacy normalizeCookieData: `{name: value}` or `[{name, value}, …]`. */
function normalizeCookieData(cookieData: unknown): CookieJar {
    if (Array.isArray(cookieData)) {
        const jar: CookieJar = {};

        for (const item of cookieData) {
            if (isRecord(item) && item.name != null && item.value != null) {
                jar[String(item.name)] = String(item.value);
            }
        }

        return jar;
    }

    if (isRecord(cookieData)) {
        return Object.fromEntries(
            Object.entries(cookieData).map(([name, value]) => [
                name,
                String(value ?? ''),
            ]),
        );
    }

    return {};
}

function sessionIdentity(session: HunguSessionData): string {
    return [
        session.baseUrl,
        session.ticket ?? '',
        session.session_idx ?? '',
    ].join('\n');
}
