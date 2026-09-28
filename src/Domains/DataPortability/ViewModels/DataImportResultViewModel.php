<?php

declare(strict_types=1);

namespace AltUU\Domains\DataPortability\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class DataImportResultViewModel extends Resource
{
    /**
     * @param  string[]  $skippedUsernames
     */
    public function __construct(
        public int $importedAccountsCount,
        public array $skippedUsernames,
        public int $importedPlaybackProgressCount,
        public int $importedAccountDailyActivitiesCount,
    ) {}
}
