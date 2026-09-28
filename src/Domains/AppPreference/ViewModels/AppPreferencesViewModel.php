<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class AppPreferencesViewModel extends Resource
{
    public function __construct(
        public string $appearance,
        public string $accentColor,
        public bool $nouToolsIntegrationEnabled,
        public bool $screenReaderEnhancedSupportEnabled,
        public bool $altUuPlusDisabled,
        public bool $onboardingCompleted,
        public string $liveSessionsTimezone,
        public bool $liveSessionNicknameModalEnabled,
        public bool $cellularPlaybackWarningEnabled,
        public string $whatsNewSeenVersion,
    ) {}
}
