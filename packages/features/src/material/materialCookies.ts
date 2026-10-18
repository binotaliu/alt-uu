import type { MaterialFetchDescriptor } from '@altuu/core';
import { setWebViewCookies, type BridgeCookie } from '@altuu/attachment-bridge';

import type { AppServices } from '../services/types';

function hostOf(url: string): string | null {
    try {
        return new URL(url).hostname;
    } catch {
        return null;
    }
}

/** `a=1; b=2` → cookies scoped to `url`'s host. */
export function parseCookieHeader(header: string): BridgeCookie[] {
    return header
        .split(';')
        .map((part) => part.trim())
        .filter((part) => part.includes('='))
        .map((part) => {
            const index = part.indexOf('=');

            return {
                name: part.slice(0, index).trim(),
                value: part.slice(index + 1).trim(),
            };
        })
        .filter((cookie) => cookie.name !== '');
}

/**
 * Splits a material fetch descriptor into the attachment bridge's
 * `headers` + host-scoped `cookies` (the bridge wants session cookies out
 * of the `Cookie` header so redirects to other hosts do not leak them).
 */
export function descriptorToDownloadRequest(
    descriptor: MaterialFetchDescriptor,
): { url: string; headers: Record<string, string>; cookies: BridgeCookie[] } {
    const headers: Record<string, string> = {};
    let cookies: BridgeCookie[] = [];
    const domain = hostOf(descriptor.url) ?? undefined;

    for (const [name, value] of Object.entries(descriptor.headers)) {
        if (name.toLowerCase() === 'cookie') {
            cookies = parseCookieHeader(value).map((cookie) => ({
                ...cookie,
                domain,
            }));
        } else {
            headers[name] = value;
        }
    }

    return { url: descriptor.url, headers, cookies };
}

/**
 * Seeds the active account's HUNGU session cookies into the WebView cookie
 * store for `url` (must be on the HUNGU host), so material HTML loaded with
 * that base URL fetches images and stylesheets as the user. Best effort.
 */
export async function seedHunguWebViewCookies(
    services: Pick<AppServices, 'storage'>,
    url: string,
): Promise<void> {
    try {
        const session = await services.storage.hunguSessions.get();
        const cookies = Object.entries(session?.cookies ?? {}).map(
            ([name, value]) => ({ name, value }),
        );

        await setWebViewCookies(url, cookies);
    } catch {
        // Without cookies the page still renders; protected images fail.
    }
}
