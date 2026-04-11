<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\AppPreference\Actions\GetLiveSessionsTimezone;
use AltUU\Domains\AppPreference\Actions\SetLiveSessionsTimezone;
use AltUU\Domains\AppPreference\DataTransferObjects\SetLiveSessionsTimezoneInputData;
use AltUU\Domains\AppPreference\ViewModels\LiveSessionsTimezonePreferenceViewModel;

final class LiveSessionsTimezonePreferenceController
{
    public function show(GetLiveSessionsTimezone $getTimezone): LiveSessionsTimezonePreferenceViewModel
    {
        return new LiveSessionsTimezonePreferenceViewModel($getTimezone());
    }

    public function store(
        SetLiveSessionsTimezoneInputData $input,
        SetLiveSessionsTimezone $setTimezone,
    ): LiveSessionsTimezonePreferenceViewModel {
        return $setTimezone($input);
    }
}
