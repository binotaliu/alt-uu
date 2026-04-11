<?php

declare(strict_types=1);

namespace AltUU\Domains\MaterialPreference\Actions;

use AltUU\Domains\MaterialPreference\DataTransferObjects\SetMaterialFontScaleInputData;
use AltUU\Domains\MaterialPreference\MaterialPreferenceStore;
use AltUU\Domains\MaterialPreference\ViewModels\MaterialFontScalePreferenceViewModel;

final readonly class SetMaterialFontScale
{
    public function __construct(private MaterialPreferenceStore $store) {}

    public function __invoke(SetMaterialFontScaleInputData $input): MaterialFontScalePreferenceViewModel
    {
        $scale = $this->store->setScale($input->scale);

        return new MaterialFontScalePreferenceViewModel($scale);
    }
}
