<?php

declare(strict_types=1);

namespace App\NativeComponents\Support;

use Illuminate\Support\Facades\Cache;

/**
 * Port of `stores/connectivity.ts`: suggests the connectivity diagnostics once
 * the user keeps tapping retry on error cards without success.
 *
 * Timestamps live in the cache (not on the component) so they survive the error
 * card being remounted between attempts, like the Pinia store did.
 */
final class ConnectivityRetryTracker
{
    /** Retries within the window before diagnostics are suggested. */
    public const int RETRY_THRESHOLD = 3;

    public const int RETRY_WINDOW_SECONDS = 120;

    /** After diagnostics ran (or the user was asked) stay quiet this long. */
    public const int QUIET_PERIOD_SECONDS = 1800;

    private const string RETRIES_KEY = 'connectivity.retryTimestamps';

    private const string LAST_DIAGNOSTICS_KEY = 'connectivity.lastDiagnosticsAt';

    /**
     * Records a retry tap; true when the diagnostics prompt should open now.
     */
    public static function noteRetry(): bool
    {
        $now = time();

        if ($now - (int) Cache::get(self::LAST_DIAGNOSTICS_KEY, 0) < self::QUIET_PERIOD_SECONDS) {
            return false;
        }

        /** @var list<int> $stored */
        $stored = Cache::get(self::RETRIES_KEY, []);
        $timestamps = [
            ...array_values(array_filter($stored, static fn (int $at): bool => $now - $at < self::RETRY_WINDOW_SECONDS)),
            $now,
        ];

        if (count($timestamps) < self::RETRY_THRESHOLD) {
            Cache::put(self::RETRIES_KEY, $timestamps, self::RETRY_WINDOW_SECONDS);

            return false;
        }

        Cache::forget(self::RETRIES_KEY);

        return true;
    }

    /**
     * The user ran diagnostics or answered the prompt: suppress it for a while.
     */
    public static function noteDiagnosticsRun(): void
    {
        Cache::put(self::LAST_DIAGNOSTICS_KEY, time(), self::QUIET_PERIOD_SECONDS);
        Cache::forget(self::RETRIES_KEY);
    }
}
