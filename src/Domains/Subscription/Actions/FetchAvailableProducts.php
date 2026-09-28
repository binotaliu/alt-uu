<?php

declare(strict_types=1);

namespace AltUU\Domains\Subscription\Actions;

use AltUU\AltUUPlus\Facades\AltUUPlus;
use AltUU\Domains\Subscription\ViewModels\ProductViewModel;
use Native\Mobile\Facades\System;

final readonly class FetchAvailableProducts
{
    /**
     * @return array<int, ProductViewModel>
     */
    public function __invoke(): array
    {
        // Defaults to the iOS list when running outside a native shell (e.g. web/Herd dev,
        // via LocalAltUUPlus), matching prior behavior before product IDs became platform-specific.
        $platform = System::isAndroid() ? 'android' : 'ios';

        $productIds = (array) config("services.iap.product_ids.{$platform}", []);
        $products = AltUUPlus::fetchProducts($productIds);

        return array_map(
            fn (object $product): ProductViewModel => new ProductViewModel(
                id: $product->id,
                displayName: $product->displayName,
                description: $product->description,
                displayPrice: $product->displayPrice,
                price: (float) $product->price,
            ),
            $products,
        );
    }
}
