<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference\DataTransferObjects;

use Spatie\LaravelData\Attributes\Validation\Required;
use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class SetAltUuPlusDisabledInputData extends Data
{
    public function __construct(
        #[Required]
        public bool $disabled,
    ) {}

    /**
     * @return array<string, array<int, string>>
     */
    public static function rules(): array
    {
        return [
            'disabled' => ['required', 'boolean'],
        ];
    }
}
