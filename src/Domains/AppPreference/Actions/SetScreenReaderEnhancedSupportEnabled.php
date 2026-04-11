<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference\Actions;

use AltUU\Domains\AppPreference\AppPreferenceStore;
use AltUU\Domains\AppPreference\DataTransferObjects\SetScreenReaderEnhancedSupportEnabledInputData;
use AltUU\Domains\AppPreference\ViewModels\ScreenReaderEnhancedSupportPreferenceViewModel;

final readonly class SetScreenReaderEnhancedSupportEnabled
{
    public function __construct(private AppPreferenceStore $store) {}

    public function __invoke(SetScreenReaderEnhancedSupportEnabledInputData $input): ScreenReaderEnhancedSupportPreferenceViewModel
    {
        $enabled = $this->store->setScreenReaderEnhancedSupportEnabled($input->enabled);

        return new ScreenReaderEnhancedSupportPreferenceViewModel($enabled);
    }
}
