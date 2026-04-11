<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\MaterialPreference\Actions\GetMaterialFontScale;
use AltUU\Domains\MaterialPreference\Actions\SetMaterialFontScale;
use AltUU\Domains\MaterialPreference\DataTransferObjects\SetMaterialFontScaleInputData;
use AltUU\Domains\MaterialPreference\ViewModels\MaterialFontScalePreferenceViewModel;

final class MaterialPreferenceController
{
    public function show(GetMaterialFontScale $getMaterialFontScale): MaterialFontScalePreferenceViewModel
    {
        return new MaterialFontScalePreferenceViewModel($getMaterialFontScale());
    }

    public function store(
        SetMaterialFontScaleInputData $input,
        SetMaterialFontScale $setMaterialFontScale,
    ): MaterialFontScalePreferenceViewModel {
        return $setMaterialFontScale($input);
    }
}
