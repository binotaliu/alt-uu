<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Subscription\Actions\GetEntitlementStatus;
use AltUU\Domains\Subscription\ViewModels\EntitlementViewModel;

final class SubscriptionStatusController
{
    public function __invoke(GetEntitlementStatus $getEntitlementStatus): EntitlementViewModel
    {
        return $getEntitlementStatus();
    }
}
