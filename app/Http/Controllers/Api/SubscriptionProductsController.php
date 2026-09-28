<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Subscription\Actions\FetchAvailableProducts;
use AltUU\Domains\Subscription\ViewModels\ProductViewModel;

final class SubscriptionProductsController
{
    /**
     * @return array<int, ProductViewModel>
     */
    public function index(FetchAvailableProducts $fetchAvailableProducts): array
    {
        return $fetchAvailableProducts();
    }
}
