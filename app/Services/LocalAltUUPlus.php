<?php

declare(strict_types=1);

namespace App\Services;

use AltUU\AltUUPlus\AltUUPlus;

/**
 * Stand-in for the native IAP bridge when the app is served over the web
 * (e.g. Herd) instead of running inside a compiled NativePHP shell. Only
 * `nativephp_call()`-backed methods need mocking here; anything that also
 * depends on native device info (purchase/restore) still safely no-ops via
 * the parent's `call()` guard.
 *
 * Not final: AltUUPlus facade tests use Mockery::mock() against whichever class
 * is currently bound, which requires subclassing.
 */
class LocalAltUUPlus extends AltUUPlus
{
    /**
     * @param  array<int, string>  $productIds
     * @return array<int, object>
     */
    public function fetchProducts(array $productIds): array
    {
        $catalog = [
            'ALT_UU_PLUS.MONTHLY' => (object) [
                'displayName' => '月訂閱',
                'description' => '享有一個月的 Alt UU+ 服務',
                'displayPrice' => 'NT$90',
                'price' => 90.0,
            ],
            'ALT_UU_PLUS.YEARLY' => (object) [
                'displayName' => '年訂閱',
                'description' => '享有一整年的 Alt UU+ 服務',
                'displayPrice' => 'NT$560',
                'price' => 560.0,
            ],
            'alt_uu_plus.monthly' => (object) [
                'displayName' => '月訂閱',
                'description' => '享有一個月的 Alt UU+ 服務',
                'displayPrice' => 'NT$90',
                'price' => 90.0,
            ],
            'alt_uu_plus.yearly' => (object) [
                'displayName' => '年訂閱',
                'description' => '享有一整年的 Alt UU+ 服務',
                'displayPrice' => 'NT$560',
                'price' => 560.0,
            ],
        ];

        return array_values(array_map(
            fn (string $productId): object => (object) [
                'id' => $productId,
                ...(array) ($catalog[$productId] ?? [
                    'displayName' => $productId,
                    'description' => '本機開發用模擬方案',
                    'displayPrice' => 'NT$0',
                    'price' => 0.0,
                ]),
            ],
            $productIds,
        ));
    }
}
