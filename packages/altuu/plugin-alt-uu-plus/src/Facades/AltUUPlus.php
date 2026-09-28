<?php

declare(strict_types=1);

namespace AltUU\AltUUPlus\Facades;

use Illuminate\Support\Facades\Facade;

/**
 * @method static array<int, object> fetchProducts(array $productIds)
 * @method static object|null purchase(string $productId)
 * @method static array<int, object> restorePurchases()
 * @method static array<int, object> currentEntitlements()
 *
 * @see \AltUU\AltUUPlus\AltUUPlus
 */
final class AltUUPlus extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return \AltUU\AltUUPlus\AltUUPlus::class;
    }
}
