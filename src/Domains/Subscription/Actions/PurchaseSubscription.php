<?php

declare(strict_types=1);

namespace AltUU\Domains\Subscription\Actions;

use AltUU\AltUUPlus\Facades\AltUUPlus;
use AltUU\Domains\Subscription\DataTransferObjects\PurchaseSubscriptionInputData;
use AltUU\Domains\Subscription\EntitlementVerifier;
use AltUU\Domains\Subscription\ViewModels\EntitlementViewModel;
use Native\Mobile\Facades\System;

final readonly class PurchaseSubscription
{
    public function __construct(
        private EntitlementVerifier $verifier,
    ) {}

    public function __invoke(PurchaseSubscriptionInputData $input): EntitlementViewModel
    {
        $result = AltUUPlus::purchase($input->productId);

        if ($result === null || ($result->status ?? null) !== 'purchased') {
            return $this->verifier->inactive();
        }

        $platform = match (true) {
            System::isIos() => 'ios',
            System::isAndroid() => 'android',
            default => null,
        };

        if ($platform === null) {
            return $this->verifier->inactive();
        }

        $reference = $platform === 'ios'
            ? [
                'transaction_id' => $result->originalTransactionId ?? $result->transactionId ?? null,
                'product_id' => $result->productId ?? $input->productId,
            ]
            : ['purchase_token' => $result->purchaseToken ?? null, 'product_id' => $result->productId ?? $input->productId];

        return $this->verifier->verify($platform, $reference);
    }
}
