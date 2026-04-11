<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference\Actions;

use AltUU\Domains\AppPreference\AppPreferenceStore;
use AltUU\Domains\AppPreference\DataTransferObjects\SetNouToolsIntegrationEnabledInputData;
use AltUU\Domains\AppPreference\ViewModels\NouToolsIntegrationPreferenceViewModel;

final readonly class SetNouToolsIntegrationEnabled
{
    public function __construct(private AppPreferenceStore $store) {}

    public function __invoke(SetNouToolsIntegrationEnabledInputData $input): NouToolsIntegrationPreferenceViewModel
    {
        $enabled = $this->store->setNouToolsIntegrationEnabled($input->enabled);

        return new NouToolsIntegrationPreferenceViewModel($enabled);
    }
}
