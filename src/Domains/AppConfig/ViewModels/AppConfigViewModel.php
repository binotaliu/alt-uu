<?php

declare(strict_types=1);

namespace AltUU\Domains\AppConfig\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class AppConfigViewModel extends Resource
{
    public function __construct(
        public string $appearance,
        public string $accentColor,
        public bool $nouToolsIntegrationEnabled,
        public bool $screenReaderEnhancedSupportEnabled,
        public bool $altUuPlusDisabled,
        public string $appName,
        public string $appVersion,
        public string $appVersionCode,
        public string $appDisplayVersion,
        public string $frameworkVersion,
    ) {}
}
