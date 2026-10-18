import type { CacheRepository } from '../../db/cache';
import type { KeyValueStoreRepository } from '../../db/keyValueStore';
import { ExternalServiceUnavailableError } from '../../errors/errors';
import { dataGet, decodeJson, isRecord } from '../../http/encoding';
import { HttpTransport, type UpstreamCallListener } from '../../http/transport';
import type { Clock, Fetch } from '../../platform';
import { ValidationError } from '../account/validation';
import { readJsonRecord } from '../app-preference/appPreferenceStore';
import { limitByWidth, versionCompare } from './phpText';
import type {
  Announcement,
  AnnouncementSeverity,
  AppStatus,
  AppStatusPlatform,
  AppUpdate,
} from './types';

const FEED_KEY = 'app-status:feed';
const LAST_GOOD_KEY = 'app-status:feed-last-good';
const FAILURE_BACKOFF_KEY = 'app-status:feed-failure-backoff';
const FRESH_FOR_SECONDS = 1800;
const FAILURE_BACKOFF_SECONDS = 300;
const DISMISSED_KEY = 'app-status:dismissed';
const MAX_REMEMBERED_DISMISSALS = 50;
const SEVERITIES: readonly AnnouncementSeverity[] = [
  'info',
  'warning',
  'critical',
];

export const DEFAULT_STATICS_BASE_URL =
  'https://alt-uu-statics.wcsvdzeimhwq.workers.dev';

type Feed = Record<string, unknown>;

export interface AppStatusServicesDeps {
  fetch: Fetch;
  cache: CacheRepository;
  keyValues: KeyValueStoreRepository;
  clock: Clock;
  platform: AppStatusPlatform;
  /** Running release number; builds without one (e.g. `DEBUG`) get no banners. */
  appVersion: string;
  staticsBaseUrl?: string;
  /** Diagnostics hook (legacy UpstreamCallSubscriber saw every HTTP call). */
  onUpstreamCall?: UpstreamCallListener;
}

/**
 * GetAppStatus + DismissAppStatusItem over the statics worker's status.json.
 * The feed is cached for 30 minutes, a failed fetch backs off for 5 minutes
 * and the last good copy is kept forever and served while the feed is down.
 */
export function createAppStatusServices(deps: AppStatusServicesDeps) {
  const transport = new HttpTransport({
    fetch: deps.fetch,
    service: 'statics',
    timeoutMs: 3000,
    onUpstreamCall: deps.onUpstreamCall,
  });
  const baseUrl = (deps.staticsBaseUrl ?? DEFAULT_STATICS_BASE_URL).replace(
    /\/+$/,
    '',
  );

  async function download(): Promise<Feed | null> {
    try {
      const response = await transport.send({
        method: 'GET',
        url: `${baseUrl}/status.json`,
        headers: { Accept: 'application/json' },
      });

      if (response.status < 200 || response.status >= 300) {
        return null;
      }

      const feed = decodeJson(response.body);

      return isRecord(feed) ? (feed as Feed) : null;
    } catch (error) {
      if (error instanceof ExternalServiceUnavailableError) {
        return null;
      }

      throw error;
    }
  }

  async function lastGood(): Promise<Feed | null> {
    const feed = await deps.cache.get<unknown>(LAST_GOOD_KEY);

    return isRecord(feed) ? (feed as Feed) : null;
  }

  async function fetchFeed(): Promise<Feed | null> {
    const cached = await deps.cache.get<unknown>(FEED_KEY);

    if (isRecord(cached)) {
      return cached as Feed;
    }

    if (await deps.cache.has(FAILURE_BACKOFF_KEY)) {
      return lastGood();
    }

    const feed = await download();

    if (feed === null) {
      await deps.cache.put(FAILURE_BACKOFF_KEY, true, FAILURE_BACKOFF_SECONDS);

      return lastGood();
    }

    await deps.cache.put(FEED_KEY, feed, FRESH_FOR_SECONDS);
    await deps.cache.forever(LAST_GOOD_KEY, feed);

    return feed;
  }

  async function dismissedKeys(): Promise<string[]> {
    const record = await readJsonRecord(deps.keyValues, DISMISSED_KEY);
    const keys = record?.keys;

    return Array.isArray(keys)
      ? keys.filter((key): key is string => typeof key === 'string')
      : [];
  }

  const currentVersion = isVersion(deps.appVersion) ? deps.appVersion : null;

  function resolveUpdate(feed: Feed, dismissed: string[]): AppUpdate | null {
    const latest = dataGet(feed, `latest.${deps.platform}`);

    if (currentVersion === null || !isVersion(latest)) {
      return null;
    }

    if (versionCompare(currentVersion, latest) >= 0) {
      return null;
    }

    const minSupported = dataGet(feed, `minSupported.${deps.platform}`);
    const required =
      isVersion(minSupported) &&
      versionCompare(currentVersion, minSupported) < 0;
    const dismissKey = `update:${latest}`;

    if (!required && dismissed.includes(dismissKey)) {
      return null;
    }

    return {
      dismissKey,
      latestVersion: latest,
      storeUrl: httpsUrl(dataGet(feed, `storeUrl.${deps.platform}`)),
      required,
    };
  }

  function resolveAnnouncements(
    feed: Feed,
    dismissed: string[],
  ): Announcement[] {
    const entries = dataGet(feed, 'announcements');

    if (!Array.isArray(entries)) {
      return [];
    }

    const announcements: Announcement[] = [];

    for (const entry of entries) {
      if (!isRecord(entry) || !appliesHere(entry as Feed)) {
        continue;
      }

      const { id, title, body, severity } = entry as Feed;

      if (
        typeof id !== 'string' ||
        id === '' ||
        typeof title !== 'string' ||
        title === ''
      ) {
        continue;
      }

      const dismissible = (entry as Feed).dismissible !== false;
      const dismissKey = `announcement:${id}`;

      if (dismissible && dismissed.includes(dismissKey)) {
        continue;
      }

      announcements.push({
        dismissKey,
        severity:
          typeof severity === 'string' &&
          (SEVERITIES as readonly string[]).includes(severity)
            ? (severity as AnnouncementSeverity)
            : 'info',
        title: limitByWidth(title, 120),
        body: typeof body === 'string' ? limitByWidth(body, 500) : '',
        url: httpsUrl((entry as Feed).url),
        dismissible,
      });
    }

    return announcements;
  }

  function appliesHere(entry: Feed): boolean {
    const platforms = entry.platforms;

    if (
      Array.isArray(platforms) &&
      platforms.length > 0 &&
      !platforms.includes(deps.platform)
    ) {
      return false;
    }

    // A null expiry means "never expires".
    if (
      entry.expires !== null &&
      entry.expires !== undefined &&
      !isStillActive(entry.expires)
    ) {
      return false;
    }

    if (currentVersion === null) {
      return true;
    }

    const { minVersion, maxVersion } = entry;

    if (
      isVersion(minVersion) &&
      versionCompare(currentVersion, minVersion) < 0
    ) {
      return false;
    }

    return !(
      isVersion(maxVersion) && versionCompare(currentVersion, maxVersion) > 0
    );
  }

  /** An unparseable expiry counts as expired, so a typo hides the notice. */
  function isStillActive(expires: unknown): boolean {
    if (typeof expires !== 'string') {
      return false;
    }

    const parsed = Date.parse(expires);

    return !Number.isNaN(parsed) && parsed > deps.clock.now().getTime();
  }

  async function get(): Promise<AppStatus> {
    const feed = await fetchFeed();

    if (feed === null) {
      return { update: null, announcements: [] };
    }

    const dismissed = await dismissedKeys();

    return {
      update: resolveUpdate(feed, dismissed),
      announcements: resolveAnnouncements(feed, dismissed),
    };
  }

  return {
    get,

    /** Keys look like `update:1.2.0` or `announcement:<id>`. */
    async dismiss(dismissKey: string): Promise<AppStatus> {
      if (
        typeof dismissKey !== 'string' ||
        [...dismissKey].length > 128 ||
        !/^(update|announcement):.+$/s.test(dismissKey)
      ) {
        throw ValidationError.field('dismissKey', 'dismissKey 格式不正確。');
      }

      const keys = [...new Set([...(await dismissedKeys()), dismissKey])].slice(
        -MAX_REMEMBERED_DISMISSALS,
      );
      await deps.keyValues.set(DISMISSED_KEY, JSON.stringify({ keys }));

      return get();
    },
  };
}

export type AppStatusServices = ReturnType<typeof createAppStatusServices>;

function isVersion(value: unknown): value is string {
  return typeof value === 'string' && /^\d+(\.\d+)*/.test(value);
}

function httpsUrl(url: unknown): string | null {
  return typeof url === 'string' && url.startsWith('https://') ? url : null;
}
