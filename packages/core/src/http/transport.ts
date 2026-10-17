import { ExternalServiceUnavailableError } from '../errors/errors';
import type { Fetch, FetchResponse } from '../platform';
import { applySetCookies, cookieHeader, type CookieJar } from './cookies';
import { hostOf, resolveUrl } from './url';

/**
 * One finished (or failed) upstream call, for the diagnostics recorder
 * (legacy UpstreamCallSubscriber). Redaction is the recorder's job, so the
 * URL and body are raw.
 */
export interface UpstreamCallEvent {
    service: string;
    method: string;
    /** The URL that was requested (before any redirect). */
    url: string;
    host: string;
    /** Final status, or null when the connection failed. */
    status: number | null;
    durationMs: number;
    /** False for HTML / file fetches, so a non-JSON 200 is not an anomaly. */
    expectsJson: boolean;
    /** Final response body (empty for HEAD), or null on connection failure. */
    body: string | null;
    redirectCount: number;
    error: { name: string; message: string } | null;
}

export type UpstreamCallListener = (event: UpstreamCallEvent) => void;

export interface HttpRequest {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string | null;
    /** Sent as one `Cookie` header to the request's own host only. */
    cookies?: CookieJar;
    /** Default true, like Guzzle's `allow_redirects`. */
    followRedirects?: boolean;
    /** Diagnostics hint only. Default true. */
    expectsJson?: boolean;
}

export interface HttpResponse {
    status: number;
    /** Final URL after redirects. */
    url: string;
    header(name: string): string | null;
    /**
     * Every Set-Cookie header received from the request's host, across all
     * redirect hops, in order. Feed them to {@link applySetCookies}.
     */
    setCookies: string[];
    body: string;
    redirectCount: number;
}

export interface HttpTransportOptions {
    fetch: Fetch;
    /** Label for diagnostics events, e.g. `hungu`. */
    service: string;
    /** Whole-call timeout, redirects included. Legacy: `Http::timeout(30)`. */
    timeoutMs?: number;
    /** Guzzle default: 5. */
    maxRedirects?: number;
    onUpstreamCall?: UpstreamCallListener;
    now?: () => number;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Sends requests with an explicit cookie jar and follows redirects in JS.
 *
 * The platform Fetch is always called with `redirect: 'manual'` so that
 * Set-Cookie headers on intermediate 3xx responses are visible and the
 * Cookie header never leaks to another host. Redirect rewriting follows
 * Guzzle's defaults (strict = false): 303, and 301/302 for unsafe methods,
 * become a body-less GET. Network failures and timeouts become
 * {@link ExternalServiceUnavailableError}, like Laravel's ConnectionException.
 */
export class HttpTransport {
    private readonly timeoutMs: number;
    private readonly maxRedirects: number;
    private readonly now: () => number;

    constructor(private readonly options: HttpTransportOptions) {
        this.timeoutMs = options.timeoutMs ?? 30_000;
        this.maxRedirects = options.maxRedirects ?? 5;
        this.now = options.now ?? Date.now;
    }

    async send(request: HttpRequest): Promise<HttpResponse> {
        const startedAt = this.now();
        const requestHost = hostOf(request.url);
        const followRedirects = request.followRedirects ?? true;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        let method = request.method.toUpperCase();
        let url = request.url;
        let body = request.body ?? null;
        let headers = { ...(request.headers ?? {}) };
        let jar: CookieJar = { ...(request.cookies ?? {}) };
        const setCookies: string[] = [];
        let redirectCount = 0;

        try {
            for (;;) {
                const sameHost = hostOf(url) === requestHost;
                const response = await this.fetchHop(url, {
                    method,
                    headers: withCookieHeader(headers, sameHost ? jar : {}),
                    body,
                    signal: controller.signal,
                });

                const hopSetCookies = response.setCookies();

                if (sameHost) {
                    setCookies.push(...hopSetCookies);
                    jar = applySetCookies(
                        jar,
                        hopSetCookies,
                        new Date(this.now()),
                    );
                }

                const location = response.headers.get('location');

                if (
                    followRedirects &&
                    REDIRECT_STATUSES.has(response.status) &&
                    location !== null &&
                    location !== '' &&
                    redirectCount < this.maxRedirects
                ) {
                    redirectCount += 1;
                    url = resolveUrl(location, url);

                    if (
                        response.status === 303 ||
                        (response.status <= 302 && !SAFE_METHODS.has(method))
                    ) {
                        method = SAFE_METHODS.has(method) ? method : 'GET';
                        body = null;
                        headers = withoutBodyHeaders(headers);
                    }

                    continue;
                }

                const text =
                    method === 'HEAD' ? '' : await this.readText(response);
                const result: HttpResponse = {
                    status: response.status,
                    url,
                    header: (name) => response.headers.get(name),
                    setCookies,
                    body: text,
                    redirectCount,
                };

                this.emit({
                    method,
                    request,
                    startedAt,
                    status: response.status,
                    body: text,
                    redirectCount,
                    error: null,
                });

                return result;
            }
        } catch (error) {
            const wrapped =
                error instanceof ExternalServiceUnavailableError
                    ? error
                    : new ExternalServiceUnavailableError({ cause: error });
            const cause =
                wrapped.cause instanceof Error ? wrapped.cause : wrapped;

            this.emit({
                method,
                request,
                startedAt,
                status: null,
                body: null,
                redirectCount,
                error: { name: cause.name, message: cause.message },
            });

            throw wrapped;
        } finally {
            clearTimeout(timer);
        }
    }

    private async fetchHop(
        url: string,
        init: {
            method: string;
            headers: Record<string, string>;
            body: string | null;
            signal: AbortSignal;
        },
    ): Promise<FetchResponse> {
        try {
            return await this.options.fetch(url, {
                ...init,
                redirect: 'manual',
            });
        } catch (error) {
            throw new ExternalServiceUnavailableError({ cause: error });
        }
    }

    private async readText(response: FetchResponse): Promise<string> {
        try {
            return await response.text();
        } catch (error) {
            throw new ExternalServiceUnavailableError({ cause: error });
        }
    }

    private emit(details: {
        method: string;
        request: HttpRequest;
        startedAt: number;
        status: number | null;
        body: string | null;
        redirectCount: number;
        error: UpstreamCallEvent['error'];
    }): void {
        const listener = this.options.onUpstreamCall;

        if (listener === undefined) {
            return;
        }

        try {
            listener({
                service: this.options.service,
                method: details.request.method.toUpperCase(),
                url: details.request.url,
                host: hostOf(details.request.url) || 'unknown',
                status: details.status,
                durationMs: Math.max(
                    0,
                    Math.round(this.now() - details.startedAt),
                ),
                expectsJson: details.request.expectsJson ?? true,
                body: details.body,
                redirectCount: details.redirectCount,
                error: details.error,
            });
        } catch {
            // A broken recorder must never break the request.
        }
    }
}

function withCookieHeader(
    headers: Record<string, string>,
    jar: CookieJar,
): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [name, value] of Object.entries(headers)) {
        if (name.toLowerCase() !== 'cookie') {
            result[name] = value;
        }
    }

    const value = cookieHeader(jar);

    if (value !== '') {
        result.cookie = value;
    }

    return result;
}

function withoutBodyHeaders(
    headers: Record<string, string>,
): Record<string, string> {
    return Object.fromEntries(
        Object.entries(headers).filter(
            ([name]) =>
                !['content-type', 'content-length'].includes(
                    name.toLowerCase(),
                ),
        ),
    );
}
