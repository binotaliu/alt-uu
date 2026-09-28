<?php

declare(strict_types=1);

namespace AltUU\Domains\DataPortability\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class DataExportViewModel extends Resource
{
    /**
     * @param  array<string, int>  $accounts
     * @param  PlaybackProgressExportItemViewModel[]  $playbackProgress
     * @param  AccountDailyActivityExportItemViewModel[]  $accountDailyActivities
     */
    public function __construct(
        public string $exportedAt,
        public array $accounts,
        public array $playbackProgress,
        public array $accountDailyActivities,
    ) {}
}
