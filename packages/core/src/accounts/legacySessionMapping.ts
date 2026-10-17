/**
 * Legacy (Laravel `encrypted:array`) session arrays use snake_case keys:
 *   base_url -> baseUrl, ua -> userAgent, cookies -> cookies.
 * Every other key (ticket, session_idx, profile, ...) is carried over
 * unchanged as an extra field. The legacy data migration (step 11) must run
 * each decrypted session through {@link fromLegacySession} before storing it.
 */
export interface MappedSession {
    baseUrl: string;
    userAgent: string;
    cookies: Record<string, string>;
    [extra: string]: unknown;
}

export function fromLegacySession(
    legacy: Record<string, unknown>,
): MappedSession {
    const { base_url, ua, cookies, ...extras } = legacy;

    return {
        ...extras,
        baseUrl: typeof base_url === 'string' ? base_url : '',
        userAgent: typeof ua === 'string' ? ua : '',
        cookies:
            cookies !== null && typeof cookies === 'object'
                ? (cookies as Record<string, string>)
                : {},
    };
}

export function toLegacySession(
    session: MappedSession,
): Record<string, unknown> {
    const { baseUrl, userAgent, cookies, ...extras } = session;

    return { ...extras, base_url: baseUrl, ua: userAgent, cookies };
}
