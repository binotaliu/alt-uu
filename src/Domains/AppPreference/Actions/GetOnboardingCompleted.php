<?php

declare(strict_types=1);

namespace AltUU\Domains\AppPreference\Actions;

use AltUU\Domains\AppPreference\AppPreferenceStore;

final readonly class GetOnboardingCompleted
{
    public function __construct(private AppPreferenceStore $store) {}

    public function __invoke(): bool
    {
        return $this->store->getOnboardingCompleted();
    }
}
