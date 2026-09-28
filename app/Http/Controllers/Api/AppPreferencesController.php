<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\AppPreference\Actions\GetAppPreferences;
use AltUU\Domains\AppPreference\Actions\UpdateAppPreferences;
use AltUU\Domains\AppPreference\DataTransferObjects\UpdateAppPreferencesInputData;
use AltUU\Domains\AppPreference\ViewModels\AppPreferencesViewModel;

final class AppPreferencesController
{
    public function show(GetAppPreferences $getAppPreferences): AppPreferencesViewModel
    {
        return $getAppPreferences();
    }

    public function update(UpdateAppPreferencesInputData $input, UpdateAppPreferences $updateAppPreferences): AppPreferencesViewModel
    {
        return $updateAppPreferences($input);
    }
}
