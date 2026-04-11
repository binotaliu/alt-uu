<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference\Actions;

use AltUU\Domains\AppPreference\AppPreferenceStore;
use AltUU\Domains\AppPreference\DataTransferObjects\SetLiveSessionsTimezoneInputData;
use AltUU\Domains\AppPreference\ViewModels\LiveSessionsTimezonePreferenceViewModel;

final readonly class SetLiveSessionsTimezone
{
    public function __construct(private AppPreferenceStore $store) {}

    public function __invoke(SetLiveSessionsTimezoneInputData $input): LiveSessionsTimezonePreferenceViewModel
    {
        $timezone = $this->store->setLiveSessionsTimezone($input->timezone);

        return new LiveSessionsTimezonePreferenceViewModel($timezone);
    }
}
