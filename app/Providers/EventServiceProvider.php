<?php

declare(strict_types=1);

namespace App\Providers;

use AltUU\Domains\StudyTime\Events\StudyTimeRecorded;
use AltUU\Domains\StudyTime\Listeners\ClearCoursePathInfoCache;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

final class EventServiceProvider extends ServiceProvider
{
    /**
     * The event listener mappings for the application.
     *
     * @var array<class-string, array<int, class-string>>
     */
    protected $listen = [
        StudyTimeRecorded::class => [
            ClearCoursePathInfoCache::class,
        ],
    ];
}
