<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference\DataTransferObjects;

use Spatie\LaravelData\Attributes\Validation\Max;
use Spatie\LaravelData\Attributes\Validation\Required;
use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class SetLiveSessionsTimezoneInputData extends Data
{
    public function __construct(
        #[Required, Max(16)]
        public string $timezone,
    ) {}

    /**
     * @return array<string, array<int, string>>
     */
    public static function rules(): array
    {
        return [
            'timezone' => ['required', 'string', 'in:taiwan,local'],
        ];
    }
}
