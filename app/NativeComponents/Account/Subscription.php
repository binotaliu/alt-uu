<?php

declare(strict_types=1);

namespace App\NativeComponents\Account;

use AltUU\Domains\Subscription\Actions\FetchAvailableProducts;
use AltUU\Domains\Subscription\Actions\GetCachedEntitlement;
use AltUU\Domains\Subscription\Actions\GetEntitlementStatus;
use AltUU\Domains\Subscription\Actions\PurchaseSubscription;
use AltUU\Domains\Subscription\Actions\RestorePurchases;
use AltUU\Domains\Subscription\DataTransferObjects\PurchaseSubscriptionInputData;
use AltUU\Domains\Subscription\ViewModels\EntitlementViewModel;
use AltUU\Domains\Subscription\ViewModels\ProductViewModel;
use App\NativeComponents\Concerns\ShowsToasts;
use App\NativeComponents\Concerns\UsesNativeDialogs;
use Illuminate\Support\Facades\Date;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Facades\Browser;
use Native\Mobile\Facades\System;
use Throwable;

/**
 * Alt UU+ subscription (Account/Subscription.vue): shows the current
 * entitlement, lists the store products, purchases, restores, and links to
 * the store's subscription management page.
 *
 * Entitlement and product Actions talk to the app's own backend and the
 * alt-uu-plus plugin, not to the school system, so there is no Hungu session
 * guard here. A cancelled purchase comes back as an inactive entitlement, not
 * an exception, and is silent, as in the SPA.
 */
final class Subscription extends NativeComponent
{
    use ShowsToasts;
    use UsesNativeDialogs;

    public const array PERKS = [
        '切換不同顏色主題',
        '檢視每日學習統計',
        '支持 Alt UU 的開發與維護',
    ];

    private const string IOS_MANAGE_URL = 'itms-apps://apps.apple.com/account/subscriptions';

    private const string ANDROID_MANAGE_URL = 'https://play.google.com/store/account/subscriptions';

    public bool $loaded = false;

    public bool $active = false;

    public ?string $productId = null;

    public ?string $expiresAt = null;

    /** @var array<int, ProductViewModel> */
    public array $products = [];

    public bool $loadingProducts = false;

    public bool $productsFailed = false;

    public bool $purchasing = false;

    public bool $restoring = false;

    public function navTitle(): string
    {
        return 'Alt UU+';
    }

    public function mount(): void
    {
        $this->applyEntitlement(app(GetCachedEntitlement::class)());
        $this->loaded = true;

        $this->loadProducts();
        $this->refreshEntitlement();
    }

    public function loadProducts(): void
    {
        $this->loadingProducts = true;
        $this->productsFailed = false;

        try {
            $this->products = app(FetchAvailableProducts::class)();
        } catch (Throwable) {
            $this->products = [];
            $this->productsFailed = true;
        } finally {
            $this->loadingProducts = false;
        }
    }

    public function purchase(string $productId): void
    {
        if ($this->purchasing || $this->restoring) {
            return;
        }

        $this->purchasing = true;

        try {
            $this->applyEntitlement(app(PurchaseSubscription::class)(new PurchaseSubscriptionInputData($productId)));
        } catch (Throwable) {
            $this->alertWithDialog('購買失敗', '購買失敗，請稍後重試');
        } finally {
            $this->purchasing = false;
        }
    }

    public function restore(): void
    {
        if ($this->purchasing || $this->restoring) {
            return;
        }

        $this->restoring = true;

        try {
            $entitlement = app(RestorePurchases::class)();
            $this->applyEntitlement($entitlement);

            if (! $entitlement->active) {
                $this->toast('找不到可還原的購買');
            }
        } catch (Throwable) {
            $this->alertWithDialog('還原購買失敗', '還原購買失敗，請稍後重試');
        } finally {
            $this->restoring = false;
        }
    }

    public function manageSubscription(): void
    {
        Browser::open($this->isAndroid() ? self::ANDROID_MANAGE_URL : self::IOS_MANAGE_URL);
    }

    public function render(): View
    {
        $currentProduct = collect($this->products)->first(fn (ProductViewModel $product): bool => $product->id === $this->productId);

        return view('native.account.subscription', [
            'perks' => self::PERKS,
            'currentProductName' => $this->productId === null ? null : ($currentProduct->displayName ?? $this->productId),
            'expiryLabel' => $this->expiryLabel(),
            'platformName' => $this->isAndroid() ? 'Google Play' : 'Apple App Store',
        ]);
    }

    private function refreshEntitlement(): void
    {
        try {
            $this->applyEntitlement(app(GetEntitlementStatus::class)());
        } catch (Throwable) {
            // Keep the last known entitlement when the backend is unreachable.
        }
    }

    private function applyEntitlement(EntitlementViewModel $entitlement): void
    {
        $this->active = $entitlement->active;
        $this->productId = $entitlement->productId;
        $this->expiresAt = $entitlement->expiresAt;
    }

    private function expiryLabel(): string
    {
        if ($this->expiresAt === null || $this->expiresAt === '') {
            return '';
        }

        try {
            return Date::parse($this->expiresAt)->format('Y年n月j日');
        } catch (Throwable) {
            return '';
        }
    }

    private function isAndroid(): bool
    {
        return System::isAndroid();
    }
}
