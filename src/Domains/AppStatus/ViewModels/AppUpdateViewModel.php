<?php

declare(strict_types=1);

namespace AltUU\Domains\AppStatus\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class AppUpdateViewModel extends Resource
{
    public function __construct(
        public string $dismissKey,
        public string $latestVersion,
        public ?string $storeUrl,
        public bool $required,
    ) {}
}
