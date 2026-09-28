<?php

declare(strict_types=1);

namespace AltUU\Domains\Subscription\Actions;

use AltUU\Domains\Subscription\EntitlementVerifier;
use AltUU\Domains\Subscription\SubscriptionEntitlementStore;
use AltUU\Domains\Subscription\ViewModels\EntitlementViewModel;
use Illuminate\Support\Carbon;

/**
 * Local-only entitlement lookup: never touches the network, so the app can assume the last known
 * state immediately and let the backend refresh correct it afterwards.
 */
final readonly class GetCachedEntitlement
{
    public function __construct(
        private SubscriptionEntitlementStore $store,
        private EntitlementVerifier $verifier,
    ) {}

    public function __invoke(): EntitlementViewModel
    {
        $cached = $this->store->get();

        if ($cached === null) {
            return $this->verifier->inactive();
        }

        return new EntitlementViewModel(
            active: $cached['active'] && ! $this->hasExpired($cached['expiresAt']),
            productId: $cached['productId'],
            expiresAt: $cached['expiresAt'],
            platform: $cached['platform'],
        );
    }

    /**
     * An offline device never hears that the subscription ended, so a cached "active" must not
     * outlive the expiry date it was cached with.
     */
    private function hasExpired(?string $expiresAt): bool
    {
        return $expiresAt !== null && Carbon::parse($expiresAt)->isPast();
    }
}
