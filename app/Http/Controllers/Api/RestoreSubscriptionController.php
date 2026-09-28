<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Subscription\Actions\RestorePurchases;
use AltUU\Domains\Subscription\ViewModels\EntitlementViewModel;

final class RestoreSubscriptionController
{
    public function __invoke(RestorePurchases $restorePurchases): EntitlementViewModel
    {
        return $restorePurchases();
    }
}
