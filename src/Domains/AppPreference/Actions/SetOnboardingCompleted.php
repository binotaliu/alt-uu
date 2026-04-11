<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference\Actions;

use AltUU\Domains\AppPreference\AppPreferenceStore;
use AltUU\Domains\AppPreference\DataTransferObjects\SetOnboardingCompletedInputData;
use AltUU\Domains\AppPreference\ViewModels\OnboardingPreferenceViewModel;

final readonly class SetOnboardingCompleted
{
    public function __construct(private AppPreferenceStore $store) {}

    public function __invoke(SetOnboardingCompletedInputData $input): OnboardingPreferenceViewModel
    {
        $completed = $this->store->setOnboardingCompleted($input->completed);

        return new OnboardingPreferenceViewModel($completed);
    }
}
