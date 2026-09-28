<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Subscription\Actions\PurchaseSubscription;
use AltUU\Domains\Subscription\DataTransferObjects\PurchaseSubscriptionInputData;
use AltUU\Domains\Subscription\ViewModels\EntitlementViewModel;

final class PurchaseSubscriptionController
{
    public function __invoke(
        PurchaseSubscriptionInputData $input,
        PurchaseSubscription $purchaseSubscription,
    ): EntitlementViewModel {
        return $purchaseSubscription($input);
    }
}
