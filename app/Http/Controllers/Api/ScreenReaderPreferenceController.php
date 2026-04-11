<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\AppPreference\Actions\GetScreenReaderEnhancedSupportEnabled;
use AltUU\Domains\AppPreference\Actions\SetScreenReaderEnhancedSupportEnabled;
use AltUU\Domains\AppPreference\DataTransferObjects\SetScreenReaderEnhancedSupportEnabledInputData;
use AltUU\Domains\AppPreference\ViewModels\ScreenReaderEnhancedSupportPreferenceViewModel;

final class ScreenReaderPreferenceController
{
    public function show(GetScreenReaderEnhancedSupportEnabled $getEnabled): ScreenReaderEnhancedSupportPreferenceViewModel
    {
        return new ScreenReaderEnhancedSupportPreferenceViewModel($getEnabled());
    }

    public function store(
        SetScreenReaderEnhancedSupportEnabledInputData $input,
        SetScreenReaderEnhancedSupportEnabled $setEnabled,
    ): ScreenReaderEnhancedSupportPreferenceViewModel {
        return $setEnabled($input);
    }
}
