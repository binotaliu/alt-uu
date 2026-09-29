<?php

declare(strict_types=1);

namespace AltUU\Domains\AppStatus;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Reads status.json from the statics site: the latest released version and
 * any known-issue announcements.
 *
 * The result is cached so opening the app never waits on the network, and a
 * failed fetch is remembered for a few minutes so an offline device does not
 * retry on every launch of the courses screen. The last good copy is kept
 * indefinitely and served while the feed is unreachable.
 */
final readonly class AppStatusFeedClient
{
    private const FEED_KEY = 'app-status:feed';

    private const LAST_GOOD_KEY = 'app-status:feed-last-good';

    private const FAILURE_BACKOFF_KEY = 'app-status:feed-failure-backoff';

    private const FRESH_FOR_SECONDS = 1800;

    private const FAILURE_BACKOFF_SECONDS = 300;

    /**
     * @return array<string, mixed>|null
     */
    public function fetch(): ?array
    {
        $cached = Cache::get(self::FEED_KEY);

        if (is_array($cached)) {
            return $cached;
        }

        if (Cache::has(self::FAILURE_BACKOFF_KEY)) {
            return $this->lastGood();
        }

        $feed = $this->download();

        if ($feed === null) {
            Cache::put(self::FAILURE_BACKOFF_KEY, true, self::FAILURE_BACKOFF_SECONDS);

            return $this->lastGood();
        }

        Cache::put(self::FEED_KEY, $feed, self::FRESH_FOR_SECONDS);
        Cache::forever(self::LAST_GOOD_KEY, $feed);

        return $feed;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function download(): ?array
    {
        $url = rtrim((string) config('services.statics.base_url'), '/').'/status.json';

        try {
            $response = Http::timeout(3)
                ->connectTimeout(2)
                ->acceptJson()
                ->get($url);
        } catch (ConnectionException) {
            return null;
        }

        if (! $response->successful()) {
            return null;
        }

        $feed = $response->json();

        return is_array($feed) ? $feed : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function lastGood(): ?array
    {
        $feed = Cache::get(self::LAST_GOOD_KEY);

        return is_array($feed) ? $feed : null;
    }
}
