<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference\Actions;

use AltUU\Domains\Account\Exceptions\PremiumRequiredException;
use AltUU\Domains\AppPreference\AppPreferenceStore;
use AltUU\Domains\AppPreference\DataTransferObjects\UpdateAppPreferencesInputData;
use AltUU\Domains\AppPreference\ViewModels\AppPreferencesViewModel;
use AltUU\Domains\Subscription\Actions\GetEntitlementStatus;
use Spatie\LaravelData\Optional;

final readonly class UpdateAppPreferences
{
    public function __construct(
        private AppPreferenceStore $store,
        private GetAppPreferences $getAppPreferences,
        private GetEntitlementStatus $getEntitlementStatus,
    ) {}

    public function __invoke(UpdateAppPreferencesInputData $input): AppPreferencesViewModel
    {
        $this->ensureAccentColorChangeIsAllowed($input);

        if (! $input->appearance instanceof Optional) {
            $this->store->setAppearance($input->appearance);
        }

        if (! $input->accentColor instanceof Optional) {
            $this->store->setAccentColor($input->accentColor);
        }

        if (! $input->nouToolsIntegrationEnabled instanceof Optional) {
            $this->store->setNouToolsIntegrationEnabled($input->nouToolsIntegrationEnabled);
        }

        if (! $input->screenReaderEnhancedSupportEnabled instanceof Optional) {
            $this->store->setScreenReaderEnhancedSupportEnabled($input->screenReaderEnhancedSupportEnabled);
        }

        if (! $input->altUuPlusDisabled instanceof Optional) {
            $this->store->setAltUuPlusDisabled($input->altUuPlusDisabled);
        }

        if (! $input->onboardingCompleted instanceof Optional) {
            $this->store->setOnboardingCompleted($input->onboardingCompleted);
        }

        if (! $input->liveSessionsTimezone instanceof Optional) {
            $this->store->setLiveSessionsTimezone($input->liveSessionsTimezone);
        }

        if (! $input->liveSessionNicknameModalEnabled instanceof Optional) {
            $this->store->setLiveSessionNicknameModalEnabled($input->liveSessionNicknameModalEnabled);
        }

        if (! $input->cellularPlaybackWarningEnabled instanceof Optional) {
            $this->store->setCellularPlaybackWarningEnabled($input->cellularPlaybackWarningEnabled);
        }

        if (! $input->whatsNewSeenVersion instanceof Optional) {
            $this->store->setWhatsNewSeenVersion($input->whatsNewSeenVersion);
        }

        return ($this->getAppPreferences)();
    }

    /**
     * Picking an accent other than the default is an Alt UU+ feature; going back to the default
     * is always allowed. Checked up front so a rejected PATCH doesn't partially apply.
     */
    private function ensureAccentColorChangeIsAllowed(UpdateAppPreferencesInputData $input): void
    {
        if ($input->accentColor instanceof Optional) {
            return;
        }

        $isDefaultOrUnchanged = $input->accentColor === AppPreferenceStore::DEFAULT_ACCENT_COLOR
            || $input->accentColor === $this->store->getAccentColor();

        if ($isDefaultOrUnchanged) {
            return;
        }

        if (! ($this->getEntitlementStatus)()->active) {
            throw new PremiumRequiredException;
        }
    }
}
