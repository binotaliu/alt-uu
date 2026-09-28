<?php

declare(strict_types=1);

namespace AltUU\Domains\DataPortability\DataTransferObjects;

use Spatie\LaravelData\Attributes\Validation\Required;
use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class AccountDailyActivityImportItemData extends Data
{
    public function __construct(
        #[Required]
        public string $username,
        #[Required]
        public string $activityDate,
        #[Required]
        public int $totalSeconds,
    ) {}

    /**
     * @return array<string, array<int, string>>
     */
    public static function rules(): array
    {
        return [
            'username' => ['required', 'string'],
            'activityDate' => ['required', 'date_format:Y-m-d'],
            'totalSeconds' => ['required', 'integer', 'min:0'],
        ];
    }
}
