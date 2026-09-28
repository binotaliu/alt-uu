<?php

declare(strict_types=1);

namespace AltUU\Domains\Subscription\Actions;

use AltUU\AltUUPlus\Facades\AltUUPlus;
use AltUU\Domains\Subscription\EntitlementVerifier;
use AltUU\Domains\Subscription\ViewModels\EntitlementViewModel;
use Native\Mobile\Facades\System;

final readonly class RestorePurchases
{
    public function __construct(
        private EntitlementVerifier $verifier,
    ) {}

    public function __invoke(): EntitlementViewModel
    {
        $entitlements = AltUUPlus::restorePurchases();

        $platform = match (true) {
            System::isIos() => 'ios',
            System::isAndroid() => 'android',
            default => null,
        };

        if ($platform === null || $entitlements === []) {
            return $this->verifier->inactive();
        }

        $latest = $entitlements[0];

        $reference = $platform === 'ios'
            ? [
                'transaction_id' => $latest->originalTransactionId ?? $latest->transactionId ?? null,
                'product_id' => $latest->productId ?? null,
            ]
            : ['purchase_token' => $latest->purchaseToken ?? null, 'product_id' => $latest->productId ?? ($latest->productIds[0] ?? null)];

        return $this->verifier->verify($platform, $reference);
    }
}
