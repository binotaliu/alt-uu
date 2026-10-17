import { applySetCookies } from '../../../http/cookies';
import {
    HttpTransport,
    type UpstreamCallListener,
} from '../../../http/transport';
import type { HunguClient } from '../../../hungu/hunguClient';
import type { Fetch, FetchResponse } from '../../../platform';
import {
    binaryStringToBytes,
    bytesToBinaryString,
    decodeLegacyText,
} from '../encoding/legacyText';
import type { MaterialContentClient } from './parseMaterialContent';

export interface HunguMaterialContentClientDeps {
    hungu: Pick<
        HunguClient,
        'probeContentType' | 'materialFetchHandoff' | 'setCookie'
    >;
    /** The platform fetch HunguClient uses. */
    fetch: Fetch;
    onUpstreamCall?: UpstreamCallListener;
    timeoutMs?: number;
    now?: () => number;
}

/** Legacy `rawContentHttp` accept header. */
const RAW_ACCEPT = 'application/json, */*';

/**
 * MaterialContentClient backed by HUNGU. `fetchMaterialContent` returns the
 * raw bytes (HunguClient decodes bodies as UTF-8, which loses Big5 pages):
 * it sends the same request as legacy UUProxyClient::fetchMaterialContent
 * (session cookies, UA, Origin, Referer) and merges Set-Cookie back into
 * the session.
 */
export function createHunguMaterialContentClient(
    deps: HunguMaterialContentClientDeps,
): MaterialContentClient {
    const transport = new HttpTransport({
        fetch: binaryFetch(deps.fetch),
        service: 'hungu',
        timeoutMs: deps.timeoutMs,
        now: deps.now,
        onUpstreamCall:
            deps.onUpstreamCall === undefined
                ? undefined
                : (event) =>
                      deps.onUpstreamCall?.({
                          ...event,
                          body:
                              event.body === null
                                  ? null
                                  : decodeLegacyText(
                                        binaryStringToBytes(event.body),
                                    ),
                      }),
    });

    return {
        probeContentType: (url) => deps.hungu.probeContentType(url),

        async materialFetchHandoff(url) {
            const handoff = await deps.hungu.materialFetchHandoff(url);

            return { url: handoff.url, headers: handoff.headers };
        },

        async fetchMaterialContent(url) {
            const handoff = await deps.hungu.materialFetchHandoff(url);
            const headers = Object.fromEntries(
                Object.entries(handoff.headers).filter(
                    ([name]) =>
                        !['cookie', 'accept'].includes(name.toLowerCase()),
                ),
            );
            const response = await transport.send({
                method: 'GET',
                url,
                headers: { ...headers, accept: RAW_ACCEPT },
                cookies: handoff.cookies,
                expectsJson: false,
            });

            const updated = applySetCookies(
                handoff.cookies,
                response.setCookies,
                new Date((deps.now ?? Date.now)()),
            );

            for (const [name, value] of Object.entries(updated)) {
                if (handoff.cookies[name] !== value) {
                    await deps.hungu.setCookie(name, value);
                }
            }

            return {
                status: response.status,
                contentType:
                    response.header('content-type') ??
                    'text/plain; charset=utf-8',
                body: binaryStringToBytes(response.body),
            };
        },
    };
}

/** Wraps a Fetch so `text()` yields one char per byte (no decoding). */
function binaryFetch(fetch: Fetch): Fetch {
    return async (url, init) => {
        const response = await fetch(url, init);

        return {
            status: response.status,
            headers: response.headers,
            setCookies: () => response.setCookies(),
            arrayBuffer: () => response.arrayBuffer(),
            text: async () =>
                bytesToBinaryString(
                    new Uint8Array(await response.arrayBuffer()),
                ),
        } satisfies FetchResponse;
    };
}
