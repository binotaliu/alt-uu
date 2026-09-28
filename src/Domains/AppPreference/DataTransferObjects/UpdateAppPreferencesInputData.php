<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference\DataTransferObjects;

use AltUU\Domains\AppPreference\AppPreferenceStore;
use Spatie\LaravelData\Data;
use Spatie\LaravelData\Optional;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class UpdateAppPreferencesInputData extends Data
{
    public function __construct(
        public string|Optional $appearance,
        public string|Optional $accentColor,
        public bool|Optional $nouToolsIntegrationEnabled,
        public bool|Optional $screenReaderEnhancedSupportEnabled,
        public bool|Optional $altUuPlusDisabled,
        public bool|Optional $onboardingCompleted,
        public string|Optional $liveSessionsTimezone,
        public bool|Optional $liveSessionNicknameModalEnabled,
        public bool|Optional $cellularPlaybackWarningEnabled,
        public string|Optional $whatsNewSeenVersion,
    ) {}

    /**
     * @return array<string, array<int, string>>
     */
    public static function rules(): array
    {
        return [
            'appearance' => ['sometimes', 'string', 'in:system,light,dark'],
            'accentColor' => ['sometimes', 'string', 'in:'.implode(',', AppPreferenceStore::ALLOWED_ACCENT_COLORS)],
            'nouToolsIntegrationEnabled' => ['sometimes', 'boolean'],
            'screenReaderEnhancedSupportEnabled' => ['sometimes', 'boolean'],
            'altUuPlusDisabled' => ['sometimes', 'boolean'],
            'onboardingCompleted' => ['sometimes', 'boolean'],
            'liveSessionsTimezone' => ['sometimes', 'string', 'in:taiwan,local'],
            'liveSessionNicknameModalEnabled' => ['sometimes', 'boolean'],
            'cellularPlaybackWarningEnabled' => ['sometimes', 'boolean'],
            'whatsNewSeenVersion' => ['sometimes', 'string', 'max:32'],
        ];
    }
}
