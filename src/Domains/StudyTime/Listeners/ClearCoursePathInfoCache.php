<?php

declare(strict_types=1);

namespace AltUU\Domains\StudyTime\Listeners;

use AltUU\Domains\StudyTime\Events\StudyTimeRecorded;
use Illuminate\Support\Facades\Cache;

final class ClearCoursePathInfoCache
{
    private const COURSE_PATH_INFO_CACHE_PREFIX = 'alt-uu:courses:path-info:';

    private const COURSE_PATH_INFO_IDS_KEY_PREFIX = 'alt-uu:courses:path-info:ids:';

    private const COURSE_PATH_INFO_CACHE_TTL_MINUTES = 30;

    public function handle(StudyTimeRecorded $event): void
    {
        $accountId = $event->accountId ?? 0;

        $cacheKey = self::COURSE_PATH_INFO_CACHE_PREFIX.$accountId.':'.$event->cid;
        Cache::forget($cacheKey);

        $idsKey = self::COURSE_PATH_INFO_IDS_KEY_PREFIX.$accountId;
        $ids = Cache::get($idsKey, []);
        if (! is_array($ids)) {
            $ids = [];
        }

        $ids = array_values(array_filter($ids, fn ($cid): bool => $cid !== $event->cid));
        Cache::put(
            $idsKey,
            $ids,
            now()->addMinutes(self::COURSE_PATH_INFO_CACHE_TTL_MINUTES),
        );
    }
}
