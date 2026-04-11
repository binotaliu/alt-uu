<?php

declare(strict_types=1);

namespace AltUU\Domains\StudyTime\Listeners;

use AltUU\Domains\StudyTime\Events\StudyTimeRecorded;
use Illuminate\Support\Facades\Cache;

final class ClearCoursePathInfoCache
{
    private const COURSE_PATH_INFO_CACHE_PREFIX = 'alt-uu:courses:path-info:';

    private const COURSE_PATH_INFO_IDS_KEY = 'alt-uu:courses:path-info:ids';

    private const COURSE_PATH_INFO_CACHE_TTL_MINUTES = 30;

    public function handle(StudyTimeRecorded $event): void
    {
        $cacheKey = self::COURSE_PATH_INFO_CACHE_PREFIX.$event->cid;
        Cache::forget($cacheKey);

        $ids = Cache::get(self::COURSE_PATH_INFO_IDS_KEY, []);
        if (! is_array($ids)) {
            $ids = [];
        }

        $ids = array_values(array_filter($ids, fn ($cid): bool => $cid !== $event->cid));
        Cache::put(
            self::COURSE_PATH_INFO_IDS_KEY,
            $ids,
            now()->addMinutes(self::COURSE_PATH_INFO_CACHE_TTL_MINUTES),
        );
    }
}
