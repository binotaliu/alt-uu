import { dataGet, isRecord } from '../http/encoding';
import type { HunguProfile } from './types';

/** `(string) Arr::get($array, $key, $fallback)`: only a missing key falls back. */
const asString = (value: unknown, fallback: string): string => {
    if (value === undefined) {
        return fallback;
    }

    return value === null || typeof value === 'object' ? '' : String(value);
};

/** Port of legacy UUProfileSession::normalize. */
export function normalizeHunguProfile(
    profile: unknown,
    fallbackUsername: string | null = null,
): HunguProfile | null {
    if (!isRecord(profile)) {
        return null;
    }

    const username = asString(
        dataGet(profile, 'username'),
        fallbackUsername ?? '',
    ).trim();
    const realname = asString(
        dataGet(profile, 'realname'),
        asString(dataGet(profile, 'name'), ''),
    ).trim();
    const picture = asString(dataGet(profile, 'picture'), '').trim();
    const displayName = realname !== '' ? realname : username;

    if (displayName === '' && username === '') {
        return null;
    }

    return { display_name: displayName, username, picture, realname };
}
