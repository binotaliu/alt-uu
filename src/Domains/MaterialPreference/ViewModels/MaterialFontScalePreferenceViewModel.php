<?php

declare(strict_types=1);

namespace AltUU\Domains\MaterialPreference\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class MaterialFontScalePreferenceViewModel extends Resource
{
    public function __construct(
        public float $scale,
    ) {}
}
