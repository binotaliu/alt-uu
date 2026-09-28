<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Subscription\Actions\GetCachedEntitlement;
use AltUU\Domains\Subscription\ViewModels\EntitlementViewModel;

final class CachedSubscriptionStatusController
{
    public function __invoke(GetCachedEntitlement $getCachedEntitlement): EntitlementViewModel
    {
        return $getCachedEntitlement();
    }
}
