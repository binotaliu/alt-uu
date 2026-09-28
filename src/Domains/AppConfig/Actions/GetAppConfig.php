<?php

declare(strict_types=1);

namespace AltUU\Domains\AppConfig\Actions;

use AltUU\Domains\AppConfig\ViewModels\AppConfigViewModel;
use AltUU\Domains\AppPreference\Actions\GetAccentColor;
use AltUU\Domains\AppPreference\Actions\GetAltUuPlusDisabled;
use AltUU\Domains\AppPreference\Actions\GetAppearance;
use AltUU\Domains\AppPreference\Actions\GetNouToolsIntegrationEnabled;
use AltUU\Domains\AppPreference\Actions\GetScreenReaderEnhancedSupportEnabled;

final readonly class GetAppConfig
{
    public function __construct(
        private GetAppearance $getAppearance,
        private GetAccentColor $getAccentColor,
        private GetNouToolsIntegrationEnabled $getNouToolsIntegrationEnabled,
        private GetScreenReaderEnhancedSupportEnabled $getScreenReaderEnhancedSupportEnabled,
        private GetAltUuPlusDisabled $getAltUuPlusDisabled,
    ) {}

    public function __invoke(): AppConfigViewModel
    {
        return new AppConfigViewModel(
            appearance: ($this->getAppearance)(),
            accentColor: ($this->getAccentColor)(),
            nouToolsIntegrationEnabled: ($this->getNouToolsIntegrationEnabled)(),
            screenReaderEnhancedSupportEnabled: ($this->getScreenReaderEnhancedSupportEnabled)(),
            altUuPlusDisabled: ($this->getAltUuPlusDisabled)(),
            appName: (string) config('app.name'),
            appVersion: (string) config('nativephp.version', 'unknown'),
            appVersionCode: (string) config('nativephp.version_code', 'unknown'),
            appDisplayVersion: $this->displayVersion(),
            frameworkVersion: app()->version(),
        );
    }

    private function displayVersion(): string
    {
        $configured = config('app.display_version');

        if (is_string($configured) && trim($configured) !== '') {
            return trim($configured);
        }

        $version = (string) config('nativephp.version', 'unknown');

        return $version === 'DEBUG' ? $version : "v{$version}";
    }
}
