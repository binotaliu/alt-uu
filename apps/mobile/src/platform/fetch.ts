import {
  splitSetCookieHeader,
  type Fetch,
  type FetchResponse,
} from '@altuu/core';
import { fetch as expoFetch } from 'expo/fetch';

/**
 * The app's transport for @altuu/core, backed by `expo/fetch`
 * (URLSession on iOS, OkHttp on Android).
 *
 * - `credentials: 'omit'` keeps the native shared cookie stores out of the
 *   picture: iOS sets `httpShouldHandleCookies = false`, Android swaps in
 *   `CookieJar.NO_COOKIES`. Core sends its own explicit Cookie header and
 *   reads Set-Cookie itself, so accounts never share native cookies (the
 *   WebView cookie store, seeded per account, stays separate as well).
 * - `redirect` is passed through; core always asks for `'manual'` and
 *   follows redirects in JS so Set-Cookie on a 302 is visible.
 * - iOS folds repeated Set-Cookie headers into one comma-joined value, so
 *   they are split back apart here.
 *
 * See packages/core/src/http/README.md for what must be verified on device
 * (the dev-only /dev/transport-probe screen does it).
 */
export const fetch: Fetch = async (url, init = {}) => {
  const response = await expoFetch(url, {
    method: init.method ?? 'GET',
    headers: init.headers,
    body: toBodyInit(init.body),
    redirect: init.redirect ?? 'follow',
    signal: init.signal,
    credentials: 'omit',
  });

  return {
    status: response.status,
    headers: { get: (name) => response.headers.get(name) },
    setCookies: () =>
      response._rawHeaders
        .filter(([name]) => name.toLowerCase() === 'set-cookie')
        .flatMap(([, value]) => splitSetCookieHeader(value)),
    text: () => response.text(),
    arrayBuffer: () => response.arrayBuffer(),
  } satisfies FetchResponse;
};

/** Copies a Uint8Array onto a plain ArrayBuffer, as BodyInit requires. */
function toBodyInit(
  body: string | Uint8Array | null | undefined,
): string | Uint8Array<ArrayBuffer> | null {
  if (body === undefined || body === null || typeof body === 'string') {
    return body ?? null;
  }

  return new Uint8Array(body);
}
