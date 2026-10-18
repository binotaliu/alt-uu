import type { BridgeCookie } from '@altuu/attachment-bridge';

import type { AppServices } from '../../services/types';

function hostOf(url: string): string | null {
    const match = /^[a-z][a-z0-9+.-]*:\/\/([^/:?#]+)/i.exec(url);

    return match ? match[1] : null;
}

function toBridgeCookies(
    cookies: Record<string, string>,
    baseUrl: string,
): BridgeCookie[] {
    const domain = hostOf(baseUrl);

    return Object.entries(cookies)
        .filter(([name, value]) => name !== '' && value !== '')
        .map(([name, value]) => ({
            name,
            value,
            ...(domain ? { domain } : {}),
            path: '/',
        }));
}

export interface BrowserSession {
    /** Where the HUNGU session cookies belong; null without a session. */
    baseUrl: string | null;
    cookies: BridgeCookie[];
}

/**
 * The active account's HUNGU session cookies (legacy `/api/hungu-cookies`).
 * Never throws: without a session the page simply loads unauthenticated.
 */
export async function loadHunguBrowserSession(
    services: AppServices,
): Promise<BrowserSession> {
    try {
        const handoff =
            await services.hungu.client.materialFetchHandoff('about:blank');

        return {
            baseUrl: handoff.baseUrl,
            cookies: toBridgeCookies(handoff.cookies, handoff.baseUrl),
        };
    } catch {
        return { baseUrl: null, cookies: [] };
    }
}

/**
 * Cookies to send with a download started inside the page: the HUNGU
 * session plus, when there is one, the school portal session. The bridge
 * matches them against each request host itself.
 */
export async function loadDownloadCookies(
    services: AppServices,
    hungu: BrowserSession,
    url: string,
): Promise<BridgeCookie[]> {
    const cookies = [...hungu.cookies];

    try {
        const portal = await services.schoolPortal.proxy.downloadHandoff(url);

        cookies.push(...toBridgeCookies(portal.cookies, portal.baseUrl));
    } catch {
        // No school portal session: HUNGU cookies alone.
    }

    return cookies;
}
