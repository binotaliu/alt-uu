import type { HunguSession } from '../session/types';

/**
 * Profile kept inside the HUNGU session. Keys stay snake_case because the
 * legacy session array is migrated verbatim (see accounts/legacySessionMapping).
 */
export interface HunguProfile {
    display_name: string;
    username: string;
    picture: string;
    realname: string;
}

/** The HUNGU session as the transport reads and writes it. */
export interface HunguSessionData extends HunguSession {
    ticket?: string;
    session_idx?: string;
    profile?: HunguProfile;
}

/** Decoded xmlapi JSON (`$response->json() ?? []`). */
export type HunguPayload = Record<string, unknown>;

export interface HunguPayloadResult {
    payload: HunguPayload;
}

export interface HunguPageResult {
    status: number;
    body: string;
    headers: { 'content-type': string };
}

/**
 * Everything a native downloader / WebView needs to fetch a HUNGU URL as the
 * signed-in user (replaces the legacy local material proxy).
 */
export interface HunguFetchHandoff {
    url: string;
    headers: Record<string, string>;
    /** Session base URL, for seeding WebView cookies. */
    baseUrl: string;
    cookies: Record<string, string>;
}
