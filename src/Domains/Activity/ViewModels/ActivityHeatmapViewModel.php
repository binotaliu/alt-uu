<?php

declare(strict_types=1);

namespace AltUU\Domains\Activity\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class ActivityHeatmapViewModel extends Resource
{
    /**
     * @param  ActivityDayViewModel[]  $days
     */
    public function __construct(
        public array $days,
        public int $currentStreak,
        public int $longestStreak,
        public ?string $longestStudyDayDate,
        public int $longestStudyDaySeconds,
        public bool $hasMultipleAccounts,
    ) {}
}
