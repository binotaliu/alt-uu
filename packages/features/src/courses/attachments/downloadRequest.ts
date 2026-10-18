import type { BridgeCookie, DownloadOptions } from '@altuu/attachment-bridge';

import { hostOf } from '../../shell/url';

export interface FetchDescriptor {
  url: string;
  headers: Record<string, string>;
  /** Cookie name → value when the descriptor carries them separately. */
  cookies?: Record<string, string>;
  /** Session base URL; its host scopes the cookies. */
  baseUrl?: string;
}

/** Parses a `Cookie` request header into name/value pairs. */
export function parseCookieHeader(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');

    if (separator <= 0) {
      continue;
    }

    cookies[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
  }

  return cookies;
}

/**
 * Turns a session handoff (`prepareMaterialFetch`, `downloadHandoff`) into
 * attachment-bridge download options. The bridge wants cookies as structured
 * values (matched per host on every redirect hop), never a `Cookie` header,
 * so a header-only descriptor is split up here.
 */
export function toDownloadOptions(
  descriptor: FetchDescriptor,
  fileName?: string | null,
): Pick<DownloadOptions, 'url' | 'headers' | 'cookies' | 'fileName'> {
  const headers: Record<string, string> = {};
  let cookieHeader = '';

  for (const [name, value] of Object.entries(descriptor.headers)) {
    if (name.toLowerCase() === 'cookie') {
      cookieHeader = value;
    } else {
      headers[name] = value;
    }
  }

  const cookieValues =
    descriptor.cookies ?? (cookieHeader ? parseCookieHeader(cookieHeader) : {});
  const domain = hostOf(descriptor.baseUrl ?? descriptor.url);
  const cookies: BridgeCookie[] = Object.entries(cookieValues).map(
    ([name, value]) => ({
      name,
      value,
      ...(domain ? { domain } : {}),
      path: '/',
    }),
  );

  return {
    url: descriptor.url,
    headers,
    cookies,
    ...(fileName ? { fileName } : {}),
  };
}
