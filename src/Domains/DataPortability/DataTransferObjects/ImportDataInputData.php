<?php

declare(strict_types=1);

namespace AltUU\Domains\DataPortability\DataTransferObjects;

use Spatie\LaravelData\Attributes\DataCollectionOf;
use Spatie\LaravelData\Attributes\Validation\Required;
use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class ImportDataInputData extends Data
{
    /**
     * @param  array<string, int>  $accounts
     * @param  PlaybackProgressImportItemData[]  $playbackProgress
     * @param  AccountDailyActivityImportItemData[]  $accountDailyActivities
     */
    public function __construct(
        #[Required]
        public array $accounts,
        #[DataCollectionOf(PlaybackProgressImportItemData::class)]
        public array $playbackProgress,
        #[DataCollectionOf(AccountDailyActivityImportItemData::class)]
        public array $accountDailyActivities,
    ) {}

    /**
     * @return array<string, array<int, string>>
     */
    public static function rules(): array
    {
        return [
            'accounts' => ['required', 'array'],
        ];
    }
}
