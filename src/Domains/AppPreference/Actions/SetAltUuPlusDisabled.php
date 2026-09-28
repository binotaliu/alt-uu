<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference\Actions;

use AltUU\Domains\AppPreference\AppPreferenceStore;
use AltUU\Domains\AppPreference\DataTransferObjects\SetAltUuPlusDisabledInputData;
use AltUU\Domains\AppPreference\ViewModels\AltUuPlusDisabledPreferenceViewModel;

final readonly class SetAltUuPlusDisabled
{
    public function __construct(private AppPreferenceStore $store) {}

    public function __invoke(SetAltUuPlusDisabledInputData $input): AltUuPlusDisabledPreferenceViewModel
    {
        $disabled = $this->store->setAltUuPlusDisabled($input->disabled);

        return new AltUuPlusDisabledPreferenceViewModel($disabled);
    }
}
