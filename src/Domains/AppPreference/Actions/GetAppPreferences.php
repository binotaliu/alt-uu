<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference\Actions;

use AltUU\Domains\AppPreference\AppPreferenceStore;
use AltUU\Domains\AppPreference\ViewModels\AppPreferencesViewModel;

final readonly class GetAppPreferences
{
    public function __construct(private AppPreferenceStore $store) {}

    public function __invoke(): AppPreferencesViewModel
    {
        return new AppPreferencesViewModel(
            appearance: $this->store->getAppearance(),
            accentColor: $this->store->getAccentColor(),
            nouToolsIntegrationEnabled: $this->store->getNouToolsIntegrationEnabled(),
            screenReaderEnhancedSupportEnabled: $this->store->getScreenReaderEnhancedSupportEnabled(),
            altUuPlusDisabled: $this->store->getAltUuPlusDisabled(),
            onboardingCompleted: $this->store->getOnboardingCompleted(),
            liveSessionsTimezone: $this->store->getLiveSessionsTimezone(),
            liveSessionNicknameModalEnabled: $this->store->getLiveSessionNicknameModalEnabled(),
            cellularPlaybackWarningEnabled: $this->store->getCellularPlaybackWarningEnabled(),
            whatsNewSeenVersion: $this->store->getWhatsNewSeenVersion(),
        );
    }
}
