/**
 * Test doubles for the transport layer, shared by core's Vitest suites
 * (domain services in wave 2 can reuse them). Not used at runtime.
 */
import type { Fetch, FetchRequestInit, FetchResponse } from '../platform';
import type { AccountId, SessionStore } from '../session/types';

export interface FakeReply {
    status?: number;
    /** Objects are JSON-encoded. */
    body?: string | object;
    headers?: Record<string, string>;
    setCookies?: string[];
}

export type FakeResponder =
    | FakeReply
    | Error
    | Array<FakeReply | Error>
    | ((
          request: RecordedRequest,
      ) => FakeReply | Error | Promise<FakeReply | Error>);

export interface RecordedRequest {
    url: string;
    method: string;
    /** Lower-cased header names. */
    headers: Record<string, string>;
    body: string | null;
    redirect: FetchRequestInit['redirect'];
}

/**
 * Laravel `Http::fake` style routes: the first route whose pattern matches
 * answers. `*` in a string pattern matches anything. An array answers in
 * sequence and throws once exhausted.
 */
export function createFakeFetch(
    routes: Array<[string | RegExp, FakeResponder]>,
): {
    fetch: Fetch;
    requests: RecordedRequest[];
} {
    const requests: RecordedRequest[] = [];
    const compiled = routes.map(([pattern, responder]) => ({
        regex:
            typeof pattern === 'string'
                ? new RegExp(
                      `^${pattern.split('*').map(escapeRegExp).join('.*')}$`,
                  )
                : pattern,
        responder,
    }));

    const fetch: Fetch = async (url, init = {}) => {
        if (init.signal?.aborted) {
            throw new Error('The operation was aborted.');
        }

        const headers = Object.fromEntries(
            Object.entries(init.headers ?? {}).map(([name, value]) => [
                name.toLowerCase(),
                value,
            ]),
        );
        const request: RecordedRequest = {
            url,
            method: (init.method ?? 'GET').toUpperCase(),
            headers,
            body:
                init.body === undefined || init.body === null
                    ? null
                    : typeof init.body === 'string'
                      ? init.body
                      : new TextDecoder().decode(init.body),
            redirect: init.redirect,
        };
        requests.push(request);

        const route = compiled.find(({ regex }) => regex.test(url));

        if (route === undefined) {
            throw new Error(`No fake route for ${request.method} ${url}`);
        }

        let reply: FakeReply | Error | undefined;

        if (Array.isArray(route.responder)) {
            reply = route.responder.shift();

            if (reply === undefined) {
                throw new Error(`Fake sequence exhausted for ${url}`);
            }
        } else if (typeof route.responder === 'function') {
            reply = await route.responder(request);
        } else {
            reply = route.responder;
        }

        if (reply instanceof Error) {
            throw reply;
        }

        return fakeResponse(reply);
    };

    return { fetch, requests };
}

export function fakeResponse(reply: FakeReply): FetchResponse {
    const body =
        reply.body === undefined
            ? ''
            : typeof reply.body === 'string'
              ? reply.body
              : JSON.stringify(reply.body);
    const headers = new Map(
        Object.entries(reply.headers ?? {}).map(([name, value]) => [
            name.toLowerCase(),
            value,
        ]),
    );

    return {
        status: reply.status ?? 200,
        headers: { get: (name) => headers.get(name.toLowerCase()) ?? null },
        setCookies: () => [...(reply.setCookies ?? [])],
        text: async () => body,
        arrayBuffer: async () =>
            new TextEncoder().encode(body).buffer as ArrayBuffer,
    };
}

/** In-memory SessionStore keyed by account; `undefined` = active account. */
export class InMemorySessionStore<TSession> implements SessionStore<TSession> {
    readonly sessions = new Map<AccountId, TSession>();

    constructor(public activeAccountId: AccountId | null = 1) {}

    async get(accountId?: AccountId): Promise<TSession | null> {
        const id = accountId ?? this.activeAccountId;

        const session = id === null ? undefined : this.sessions.get(id);

        return session === undefined ? null : structuredClone(session);
    }

    async put(session: TSession, accountId?: AccountId): Promise<void> {
        const id = accountId ?? this.activeAccountId;

        if (id !== null) {
            this.sessions.set(id, structuredClone(session));
        }
    }

    async clear(accountId?: AccountId): Promise<void> {
        const id = accountId ?? this.activeAccountId;

        if (id !== null) {
            this.sessions.delete(id);
        }
    }
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
