<?php

declare(strict_types=1);

use AltUU\AltUUPlus\Facades\AltUUPlus;
use App\Models\KeyValueStore;
use App\NativeComponents\Account\Subscription;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Facades\Device;
use Native\Mobile\Testing\Native;

beforeEach(function (): void {
    KeyValueStore::query()->where('key', 'subscription:entitlement')->delete();
    config()->set('services.iap.product_ids.ios', ['alt_uu_monthly']);
});

function subscriptionPlatform(string $platform): void
{
    Device::shouldReceive('getInfo')->andReturn(json_encode(['platform' => $platform]));
}

function subscriptionProducts(): array
{
    return [(object) [
        'id' => 'alt_uu_monthly',
        'displayName' => 'Alt UU+ 月訂閱',
        'description' => '每月自動續訂',
        'displayPrice' => 'NT$90',
        'price' => 90.0,
    ]];
}

it('shows the perks and the products when not subscribed', function (): void {
    subscriptionPlatform('ios');
    AltUUPlus::shouldReceive('fetchProducts')->once()->andReturn(subscriptionProducts());

    Native::test(Subscription::class)
        ->assertSee('升級 Alt UU+')
        ->assertSee('切換不同顏色主題')
        ->assertSee('檢視每日學習統計')
        ->assertSee('Alt UU+ 月訂閱')
        ->assertSee('NT$90')
        ->assertSee('已購買過？還原購買')
        ->assertSee('Apple App Store')
        ->assertDontSee('管理訂閱');
});

it('shows a retry when the products cannot be loaded and recovers', function (): void {
    subscriptionPlatform('ios');
    AltUUPlus::shouldReceive('fetchProducts')->once()->andThrow(new RuntimeException('bridge down'));

    $screen = Native::test(Subscription::class)
        ->assertSet('productsFailed', true)
        ->assertSee('無法載入訂閱方案，請稍後再試。');

    AltUUPlus::shouldReceive('fetchProducts')->once()->andReturn(subscriptionProducts());

    $screen->tap('retry-products')
        ->assertSet('productsFailed', false)
        ->assertSee('Alt UU+ 月訂閱');
});

it('purchases a product and switches to the subscribed view', function (): void {
    subscriptionPlatform('ios');
    AltUUPlus::shouldReceive('fetchProducts')->andReturn(subscriptionProducts());
    AltUUPlus::shouldReceive('purchase')->once()->with('alt_uu_monthly')->andReturn((object) [
        'status' => 'purchased',
        'productId' => 'alt_uu_monthly',
        'originalTransactionId' => 'tx-1',
    ]);
    Http::fake(['*' => Http::response([
        'active' => true,
        'product_id' => 'alt_uu_monthly',
        'expires_at' => '2030-01-15T00:00:00+00:00',
        'platform' => 'ios',
    ])]);

    Native::test(Subscription::class)
        ->tap('product-alt_uu_monthly')
        ->assertSet('active', true)
        ->assertSee('感謝你的支持！')
        ->assertSee('已訂閱')
        ->assertSee('目前方案')
        ->assertSee('Alt UU+ 月訂閱')
        ->assertSee('下次續訂日')
        ->assertSee('2030年1月15日')
        ->assertSee('管理訂閱')
        ->assertDontSee('已購買過？還原購買');
});

it('stays quiet when the purchase is cancelled', function (): void {
    subscriptionPlatform('ios');
    AltUUPlus::shouldReceive('fetchProducts')->andReturn(subscriptionProducts());
    AltUUPlus::shouldReceive('purchase')->once()->andReturn((object) ['status' => 'cancelled']);

    Native::test(Subscription::class)
        ->tap('product-alt_uu_monthly')
        ->assertSet('active', false)
        ->assertSet('purchasing', false)
        ->assertSee('升級 Alt UU+')
        ->assertNativeNotCalled('Dialog.Alert');
});

it('alerts when the purchase throws', function (): void {
    subscriptionPlatform('ios');
    AltUUPlus::shouldReceive('fetchProducts')->andReturn(subscriptionProducts());
    AltUUPlus::shouldReceive('purchase')->once()->andThrow(new RuntimeException('store error'));

    Native::test(Subscription::class)
        ->tap('product-alt_uu_monthly')
        ->assertSet('purchasing', false)
        ->assertNativeCalled('Dialog.Alert', fn (array $params): bool => $params['message'] === '購買失敗，請稍後重試');
});

it('restores a purchase', function (): void {
    subscriptionPlatform('ios');
    AltUUPlus::shouldReceive('fetchProducts')->andReturn(subscriptionProducts());
    AltUUPlus::shouldReceive('restorePurchases')->once()->andReturn([(object) [
        'productId' => 'alt_uu_monthly',
        'originalTransactionId' => 'tx-1',
    ]]);
    Http::fake(['*' => Http::response([
        'active' => true,
        'product_id' => 'alt_uu_monthly',
        'expires_at' => null,
        'platform' => 'ios',
    ])]);

    Native::test(Subscription::class)
        ->tap('restore')
        ->assertSet('active', true)
        ->assertSee('感謝你的支持！');
});

it('tells the user when there is nothing to restore', function (): void {
    subscriptionPlatform('ios');
    AltUUPlus::shouldReceive('fetchProducts')->andReturn(subscriptionProducts());
    AltUUPlus::shouldReceive('restorePurchases')->once()->andReturn([]);

    Native::test(Subscription::class)
        ->tap('restore')
        ->assertSet('active', false)
        ->assertNativeCalled('Dialog.Toast', fn (array $params): bool => $params['message'] === '找不到可還原的購買');
});

it('alerts when restoring fails', function (): void {
    subscriptionPlatform('ios');
    AltUUPlus::shouldReceive('fetchProducts')->andReturn(subscriptionProducts());
    AltUUPlus::shouldReceive('restorePurchases')->once()->andThrow(new RuntimeException('store error'));

    Native::test(Subscription::class)
        ->tap('restore')
        ->assertSet('restoring', false)
        ->assertNativeCalled('Dialog.Alert', fn (array $params): bool => $params['message'] === '還原購買失敗，請稍後重試');
});

it('starts from the cached entitlement and keeps it when offline', function (): void {
    subscriptionPlatform('ios');
    KeyValueStore::query()->create([
        'key' => 'subscription:entitlement',
        'value' => json_encode([
            'active' => true,
            'productId' => 'alt_uu_monthly',
            'expiresAt' => '2099-03-05T00:00:00+00:00',
            'platform' => 'ios',
            'reference' => ['transaction_id' => 'tx-1'],
        ]),
    ]);
    AltUUPlus::shouldReceive('fetchProducts')->andReturn(subscriptionProducts());
    Http::fake(fn () => throw new ConnectionException('offline'));

    Native::test(Subscription::class)
        ->assertSet('active', true)
        ->assertSee('感謝你的支持！')
        ->assertSee('2099年3月5日');
});

it('opens the store subscription page from manage', function (): void {
    subscriptionPlatform('ios');
    KeyValueStore::query()->create([
        'key' => 'subscription:entitlement',
        'value' => json_encode([
            'active' => true,
            'productId' => 'alt_uu_monthly',
            'expiresAt' => '2099-03-05T00:00:00+00:00',
            'platform' => 'ios',
            'reference' => null,
        ]),
    ]);
    AltUUPlus::shouldReceive('fetchProducts')->andReturn(subscriptionProducts());

    Native::test(Subscription::class)
        ->tap('manage')
        ->assertNativeCalled('Browser.Open', fn (array $params): bool => $params['url'] === 'itms-apps://apps.apple.com/account/subscriptions');
});

it('points Android users at Google Play', function (): void {
    subscriptionPlatform('android');
    AltUUPlus::shouldReceive('fetchProducts')->andReturn(subscriptionProducts());

    Native::test(Subscription::class)
        ->assertSee('Google Play')
        ->assertDontSee('Apple App Store')
        ->set('active', true)
        ->tap('manage')
        ->assertNativeCalled('Browser.Open', fn (array $params): bool => $params['url'] === 'https://play.google.com/store/account/subscriptions');
});
