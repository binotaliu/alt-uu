<?php

declare(strict_types=1);

namespace AltUU\Domains\MaterialPreference\DataTransferObjects;

use Spatie\LaravelData\Attributes\Validation\Required;
use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class SetMaterialFontScaleInputData extends Data
{
    public function __construct(
        #[Required]
        public float $scale,
    ) {}

    /**
     * @return array<string, array<int, string>>
     */
    public static function rules(): array
    {
        return [
            'scale' => ['required', 'numeric', 'min:0.7', 'max:1.6'],
        ];
    }
}
