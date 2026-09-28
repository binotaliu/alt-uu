<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference\Actions;

use AltUU\Domains\AppPreference\AppPreferenceStore;
use AltUU\Domains\AppPreference\DataTransferObjects\SetCellularPlaybackWarningEnabledInputData;
use AltUU\Domains\AppPreference\ViewModels\CellularPlaybackWarningEnabledPreferenceViewModel;

final readonly class SetCellularPlaybackWarningEnabled
{
    public function __construct(private AppPreferenceStore $store) {}

    public function __invoke(SetCellularPlaybackWarningEnabledInputData $input): CellularPlaybackWarningEnabledPreferenceViewModel
    {
        $enabled = $this->store->setCellularPlaybackWarningEnabled($input->enabled);

        return new CellularPlaybackWarningEnabledPreferenceViewModel($enabled);
    }
}
