<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class LiveSessionsTimezonePreferenceViewModel extends Resource
{
    public function __construct(
        public string $timezone,
    ) {}
}
