import { splitSetCookieHeader, type Fetch } from '@altuu/core';

/**
 * Fallback transport on React Native's global (XHR-based) fetch, kept for
 * comparison in the transport probe. Not used by the app: RN's fetch cannot
 * do `redirect: 'manual'` (it always follows, dropping Set-Cookie from the
 * 302 the school portal login depends on). `credentials: 'omit'` maps to
 * `withCredentials = false`, which keeps the native cookie jars out.
 */
export const globalFetch: Fetch = async (url, init = {}) => {
  const response = await globalThis.fetch(url, {
    method: init.method ?? 'GET',
    headers: init.headers,
    body: toBodyInit(init.body),
    signal: init.signal,
    credentials: 'omit',
  });
  const setCookie = response.headers.get('set-cookie');

  return {
    status: response.status,
    headers: { get: (name) => response.headers.get(name) },
    setCookies: () =>
      setCookie === null ? [] : splitSetCookieHeader(setCookie),
    text: () => response.text(),
    arrayBuffer: () => response.arrayBuffer(),
  };
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
