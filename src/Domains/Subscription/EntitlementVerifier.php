<?php

declare(strict_types=1);

namespace AltUU\Domains\Subscription;

use AltUU\Domains\AppPreference\AppPreferenceStore;
use AltUU\Domains\Subscription\ViewModels\EntitlementViewModel;
use App\Services\AltUUPlusClient;

final readonly class EntitlementVerifier
{
    public function __construct(
        private AltUUPlusClient $client,
        private SubscriptionEntitlementStore $store,
        private AppPreferenceStore $preferences,
    ) {}

    /**
     * @param  array<string, mixed>  $reference
     */
    public function verify(string $platform, array $reference): EntitlementViewModel
    {
        $response = $this->client->verify($platform, $reference);

        if ($response === null) {
            return $this->inactive();
        }

        return $this->cacheAndPresent($response, $platform, $reference);
    }

    /**
     * Best-effort refresh against the backend, keyed off the purchase reference cached from the
     * last successful verify/restore. Returns null (rather than an "inactive" result) when there's
     * no cached reference yet or the backend can't be reached, so callers can fall back to the last
     * cached entitlement instead of mistaking "couldn't check" for "not active".
     */
    public function refreshFromBackend(): ?EntitlementViewModel
    {
        $cached = $this->store->get();

        if ($cached === null || $cached['reference'] === null || $cached['platform'] === null) {
            return null;
        }

        $response = $this->client->entitlement($cached['platform'], $cached['reference']);

        if ($response === null) {
            return null;
        }

        return $this->cacheAndPresent($response, $cached['platform'], $cached['reference']);
    }

    public function inactive(): EntitlementViewModel
    {
        return new EntitlementViewModel(active: false, productId: null, expiresAt: null, platform: null);
    }

    /**
     * @param  array<string, mixed>  $response
     * @param  array<string, mixed>  $reference
     */
    private function cacheAndPresent(array $response, string $platform, array $reference): EntitlementViewModel
    {
        $active = (bool) ($response['active'] ?? false);
        $productId = $response['product_id'] ?? null;
        $expiresAt = $response['expires_at'] ?? null;
        $responsePlatform = $response['platform'] ?? $platform;

        $this->store->put($active, $productId, $expiresAt, $responsePlatform, $reference);

        if (! $active) {
            $this->resetPaidPreferences();
        }

        return new EntitlementViewModel($active, $productId, $expiresAt, $responsePlatform);
    }

    /**
     * Accent colors are an Alt UU+ perk, so once the backend explicitly reports the subscription as
     * inactive the accent falls back to the default.
     */
    private function resetPaidPreferences(): void
    {
        if ($this->preferences->getAccentColor() !== AppPreferenceStore::DEFAULT_ACCENT_COLOR) {
            $this->preferences->setAccentColor(AppPreferenceStore::DEFAULT_ACCENT_COLOR);
        }
    }
}
