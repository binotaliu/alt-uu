<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference\Actions;

use AltUU\Domains\AppPreference\AppPreferenceStore;
use AltUU\Domains\AppPreference\DataTransferObjects\SetAppearanceInputData;
use AltUU\Domains\AppPreference\ViewModels\AppearancePreferenceViewModel;

final readonly class SetAppearance
{
    public function __construct(private AppPreferenceStore $store) {}

    public function __invoke(SetAppearanceInputData $input): AppearancePreferenceViewModel
    {
        $appearance = $this->store->setAppearance($input->appearance);

        return new AppearancePreferenceViewModel($appearance);
    }
}
