<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\AppPreference\Actions\GetAppearance;
use AltUU\Domains\AppPreference\Actions\SetAppearance;
use AltUU\Domains\AppPreference\DataTransferObjects\SetAppearanceInputData;
use AltUU\Domains\AppPreference\ViewModels\AppearancePreferenceViewModel;

final class AppearanceController
{
    public function show(GetAppearance $getAppearance): AppearancePreferenceViewModel
    {
        return new AppearancePreferenceViewModel($getAppearance());
    }

    public function store(SetAppearanceInputData $input, SetAppearance $setAppearance): AppearancePreferenceViewModel
    {
        return $setAppearance($input);
    }
}
