<?php

declare(strict_types=1);

namespace AltUU\AltUUPlus;

// Not final: the app's tests fake this via the AltUUPlus facade's shouldReceive(), which requires
// Mockery to subclass this class.
class AltUUPlus
{
    /**
     * @param  array<int, string>  $productIds
     * @return array<int, object>
     */
    public function fetchProducts(array $productIds): array
    {
        $response = $this->call('AltUUPlus.FetchProducts', ['productIds' => $productIds]);

        return (array) ($response->products ?? []);
    }

    public function purchase(string $productId): ?object
    {
        return $this->call('AltUUPlus.Purchase', ['productId' => $productId]);
    }

    /**
     * @return array<int, object>
     */
    public function restorePurchases(): array
    {
        $response = $this->call('AltUUPlus.RestorePurchases');

        return (array) ($response->entitlements ?? []);
    }

    /**
     * @return array<int, object>
     */
    public function currentEntitlements(): array
    {
        $response = $this->call('AltUUPlus.CurrentEntitlements');

        return (array) ($response->entitlements ?? []);
    }

    /**
     * Native bridge functions return their payload as the top-level JSON
     * object (see BridgeResponse.success() in the generated NativePHP
     * project's BridgeRouter.swift, which returns `data` unwrapped) -
     * there is no enveloping "data" key to unwrap here.
     */
    private function call(string $method, array $parameters = []): ?object
    {
        if (! function_exists('nativephp_call')) {
            return null;
        }

        $result = nativephp_call($method, json_encode($parameters));

        if (! $result) {
            return null;
        }

        return json_decode($result) ?: null;
    }
}
