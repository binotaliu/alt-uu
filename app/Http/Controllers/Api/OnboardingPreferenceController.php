<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\AppPreference\Actions\GetOnboardingCompleted;
use AltUU\Domains\AppPreference\Actions\SetOnboardingCompleted;
use AltUU\Domains\AppPreference\DataTransferObjects\SetOnboardingCompletedInputData;
use AltUU\Domains\AppPreference\ViewModels\OnboardingPreferenceViewModel;

final class OnboardingPreferenceController
{
    public function show(GetOnboardingCompleted $getCompleted): OnboardingPreferenceViewModel
    {
        return new OnboardingPreferenceViewModel($getCompleted());
    }

    public function store(
        SetOnboardingCompletedInputData $input,
        SetOnboardingCompleted $setCompleted,
    ): OnboardingPreferenceViewModel {
        return $setCompleted($input);
    }
}
