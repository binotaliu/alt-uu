<?php

declare(strict_types=1);

namespace AltUU\Domains\Subscription\Actions;

use AltUU\Domains\Subscription\EntitlementVerifier;
use AltUU\Domains\Subscription\ViewModels\EntitlementViewModel;

final readonly class GetEntitlementStatus
{
    public function __construct(
        private EntitlementVerifier $verifier,
        private GetCachedEntitlement $getCachedEntitlement,
    ) {}

    public function __invoke(): EntitlementViewModel
    {
        return $this->verifier->refreshFromBackend() ?? ($this->getCachedEntitlement)();
    }
}
