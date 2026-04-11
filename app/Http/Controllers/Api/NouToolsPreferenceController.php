<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\AppPreference\Actions\GetNouToolsIntegrationEnabled;
use AltUU\Domains\AppPreference\Actions\SetNouToolsIntegrationEnabled;
use AltUU\Domains\AppPreference\DataTransferObjects\SetNouToolsIntegrationEnabledInputData;
use AltUU\Domains\AppPreference\ViewModels\NouToolsIntegrationPreferenceViewModel;

final class NouToolsPreferenceController
{
    public function show(GetNouToolsIntegrationEnabled $getEnabled): NouToolsIntegrationPreferenceViewModel
    {
        return new NouToolsIntegrationPreferenceViewModel($getEnabled());
    }

    public function store(
        SetNouToolsIntegrationEnabledInputData $input,
        SetNouToolsIntegrationEnabled $setEnabled,
    ): NouToolsIntegrationPreferenceViewModel {
        return $setEnabled($input);
    }
}
