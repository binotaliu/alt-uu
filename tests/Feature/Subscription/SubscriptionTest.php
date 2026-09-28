<?php

use AltUU\AltUUPlus\Facades\AltUUPlus;
use App\Models\KeyValueStore;
use App\Services\AccountCredentialsStore;
use App\Services\UUSessionStore;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Facades\Device;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

function seedHunguSessionForSubscription(string $username = 's1234567'): void
{
    app(AccountCredentialsStore::class)->put($username, 'test-password');
    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-example',
        'session_idx' => 'idx-example',
        'cookies' => [],
        'profile' => [
            'display_name' => '測試學生',
            'username' => $username,
            'picture' => 'https://uu.nou.edu.tw/avatar.png',
            'realname' => '測試學生',
        ],
    ]);
}

beforeEach(function () {
    KeyValueStore::query()->where('key', 'subscription:entitlement')->delete();
});

// ──────────────────────────────────────────────────────
// FetchAvailableProducts
// ──────────────────────────────────────────────────────

it('lists available subscription products', function () {
    seedHunguSessionForSubscription();

    AltUUPlus::shouldReceive('fetchProducts')
        ->once()
        ->andReturn([
            (object) [
                'id' => 'alt_uu_premium_monthly',
                'displayName' => 'Alt UU Premium',
                'description' => 'Cross-device sync',
                'displayPrice' => 'NT$90',
                'price' => 90.0,
            ],
        ]);

    getJson('/api/subscription/products')
        ->assertOk()
        ->assertJson([[
            'id' => 'alt_uu_premium_monthly',
            'displayName' => 'Alt UU Premium',
            'description' => 'Cross-device sync',
            'displayPrice' => 'NT$90',
            'price' => 90.0,
        ]]);
});

it('fetches Android products using the lowercase Play Console product IDs', function () {
    seedHunguSessionForSubscription();

    Device::shouldReceive('getInfo')
        ->andReturn(json_encode(['platform' => 'android']));

    AltUUPlus::shouldReceive('fetchProducts')
        ->once()
        ->with(['alt_uu_plus.monthly', 'alt_uu_plus.yearly'])
        ->andReturn([]);

    getJson('/api/subscription/products')->assertOk();
});

it('fetches iOS products using the uppercase App Store Connect product IDs', function () {
    seedHunguSessionForSubscription();

    Device::shouldReceive('getInfo')
        ->andReturn(json_encode(['platform' => 'ios']));

    AltUUPlus::shouldReceive('fetchProducts')
        ->once()
        ->with(['ALT_UU_PLUS.MONTHLY', 'ALT_UU_PLUS.YEARLY'])
        ->andReturn([]);

    getJson('/api/subscription/products')->assertOk();
});

// ──────────────────────────────────────────────────────
// GetEntitlementStatus
// ──────────────────────────────────────────────────────

it('refreshes and caches entitlement status from the backend using the cached purchase reference', function () {
    seedHunguSessionForSubscription();

    KeyValueStore::query()->updateOrCreate(
        ['key' => 'subscription:entitlement'],
        ['value' => json_encode([
            'active' => true,
            'productId' => 'alt_uu_premium_monthly',
            'expiresAt' => '2026-07-01T00:00:00+00:00',
            'platform' => 'ios',
            'reference' => ['transaction_id' => 'original-txn-1', 'product_id' => 'alt_uu_premium_monthly'],
            'checkedAt' => '2026-06-01T00:00:00+00:00',
        ])],
    );

    Http::fake([
        'alt-uu.binota.org/api/iap/entitlement*' => Http::response([
            'active' => true,
            'product_id' => 'alt_uu_premium_monthly',
            'expires_at' => '2026-08-01T00:00:00+00:00',
            'platform' => 'ios',
        ]),
    ]);

    getJson('/api/subscription/status')
        ->assertOk()
        ->assertJson([
            'active' => true,
            'productId' => 'alt_uu_premium_monthly',
            'expiresAt' => '2026-08-01T00:00:00+00:00',
            'platform' => 'ios',
        ]);

    Http::assertSent(function ($request) {
        return str_starts_with($request->url(), 'https://alt-uu.binota.org/api/iap/entitlement')
            && $request['platform'] === 'ios'
            && $request['transaction_id'] === 'original-txn-1'
            && ! isset($request['account_hash']);
    });

    $this->assertDatabaseHas('key_value_store', [
        'key' => 'subscription:entitlement',
    ]);
});

it('falls back to the cached entitlement when the backend is unreachable', function () {
    seedHunguSessionForSubscription();

    KeyValueStore::query()->updateOrCreate(
        ['key' => 'subscription:entitlement'],
        ['value' => json_encode([
            'active' => true,
            'productId' => 'alt_uu_premium_monthly',
            'expiresAt' => now()->addMonth()->toIso8601String(),
            'platform' => 'ios',
            'reference' => ['transaction_id' => 'original-txn-1', 'product_id' => 'alt_uu_premium_monthly'],
            'checkedAt' => '2026-07-01T00:00:00+00:00',
        ])],
    );

    Http::fake([
        'alt-uu.binota.org/api/iap/entitlement*' => Http::response(null, 500),
    ]);

    getJson('/api/subscription/status')
        ->assertOk()
        ->assertJson([
            'active' => true,
            'productId' => 'alt_uu_premium_monthly',
        ]);
});

it('falls back to the cached entitlement when the backend connection fails', function () {
    seedHunguSessionForSubscription();

    KeyValueStore::query()->updateOrCreate(
        ['key' => 'subscription:entitlement'],
        ['value' => json_encode([
            'active' => true,
            'productId' => 'alt_uu_premium_monthly',
            'expiresAt' => now()->addMonth()->toIso8601String(),
            'platform' => 'ios',
            'reference' => ['transaction_id' => 'original-txn-1', 'product_id' => 'alt_uu_premium_monthly'],
            'checkedAt' => '2026-07-01T00:00:00+00:00',
        ])],
    );

    Http::fake([
        'alt-uu.binota.org/api/iap/entitlement*' => fn () => throw new ConnectionException('offline'),
    ]);

    getJson('/api/subscription/status')
        ->assertOk()
        ->assertJson(['active' => true, 'productId' => 'alt_uu_premium_monthly']);
});

it('marks the cached entitlement inactive only when the backend says so', function () {
    seedHunguSessionForSubscription();

    KeyValueStore::query()->updateOrCreate(
        ['key' => 'subscription:entitlement'],
        ['value' => json_encode([
            'active' => true,
            'productId' => 'alt_uu_premium_monthly',
            'expiresAt' => '2026-08-01T00:00:00+00:00',
            'platform' => 'ios',
            'reference' => ['transaction_id' => 'original-txn-1', 'product_id' => 'alt_uu_premium_monthly'],
        ])],
    );

    Http::fake([
        'alt-uu.binota.org/api/iap/entitlement*' => Http::response(['active' => false, 'platform' => 'ios']),
    ]);

    getJson('/api/subscription/status')->assertOk()->assertJson(['active' => false]);
    getJson('/api/subscription/status')->assertOk()->assertJson(['active' => false]);
});

function seedAccentColorAndEntitlement(string $accentColor, bool $active): void
{
    KeyValueStore::query()->updateOrCreate(
        ['key' => 'preference:accent-color'],
        ['value' => json_encode(['accentColor' => $accentColor])],
    );

    KeyValueStore::query()->updateOrCreate(
        ['key' => 'subscription:entitlement'],
        ['value' => json_encode([
            'active' => $active,
            'productId' => 'alt_uu_premium_monthly',
            'expiresAt' => now()->addMonth()->toIso8601String(),
            'platform' => 'ios',
            'reference' => ['transaction_id' => 'original-txn-1', 'product_id' => 'alt_uu_premium_monthly'],
        ])],
    );
}

it('resets the accent color to the default when the backend reports the subscription inactive', function () {
    seedHunguSessionForSubscription();
    seedAccentColorAndEntitlement('ocean', active: true);

    Http::fake([
        'alt-uu.binota.org/api/iap/entitlement*' => Http::response(['active' => false, 'platform' => 'ios']),
    ]);

    getJson('/api/subscription/status')->assertOk()->assertJson(['active' => false]);

    getJson('/api/preferences')->assertJsonPath('accentColor', 'warm');
});

it('keeps the accent color when the backend cannot be reached', function () {
    seedHunguSessionForSubscription();
    seedAccentColorAndEntitlement('ocean', active: true);

    Http::fake(fn () => throw new ConnectionException('offline'));

    getJson('/api/subscription/status')->assertOk()->assertJson(['active' => true]);

    getJson('/api/preferences')->assertJsonPath('accentColor', 'ocean');
});

it('keeps the accent color when the backend reports the subscription active', function () {
    seedHunguSessionForSubscription();
    seedAccentColorAndEntitlement('ocean', active: true);

    Http::fake([
        'alt-uu.binota.org/api/iap/entitlement*' => Http::response(['active' => true, 'platform' => 'ios']),
    ]);

    getJson('/api/subscription/status')->assertOk()->assertJson(['active' => true]);

    getJson('/api/preferences')->assertJsonPath('accentColor', 'ocean');
});

it('returns the cached entitlement without contacting the backend', function () {
    seedHunguSessionForSubscription();

    KeyValueStore::query()->updateOrCreate(
        ['key' => 'subscription:entitlement'],
        ['value' => json_encode([
            'active' => true,
            'productId' => 'alt_uu_premium_monthly',
            'expiresAt' => now()->addMonth()->toIso8601String(),
            'platform' => 'ios',
            'reference' => ['transaction_id' => 'original-txn-1'],
        ])],
    );

    Http::fake();

    getJson('/api/subscription/status/cached')
        ->assertOk()
        ->assertJson(['active' => true, 'productId' => 'alt_uu_premium_monthly']);

    Http::assertNothingSent();
});

it('returns inactive from the cached status when nothing is stored', function () {
    seedHunguSessionForSubscription();

    getJson('/api/subscription/status/cached')->assertOk()->assertJson(['active' => false]);
});

it('returns inactive without contacting the backend when there is no cached purchase reference', function () {
    seedHunguSessionForSubscription();

    Http::fake();

    getJson('/api/subscription/status')
        ->assertOk()
        ->assertJson(['active' => false, 'productId' => null]);

    Http::assertNothingSent();
});

it('requires a Hungu session to check entitlement status', function () {
    getJson('/api/subscription/status')->assertUnauthorized();
});

// ──────────────────────────────────────────────────────
// PurchaseSubscription
// ──────────────────────────────────────────────────────

it('verifies and caches an iOS purchase', function () {
    seedHunguSessionForSubscription();

    AltUUPlus::shouldReceive('purchase')
        ->once()
        ->with('alt_uu_premium_monthly')
        ->andReturn((object) [
            'status' => 'purchased',
            'transactionId' => 'txn-1',
            'originalTransactionId' => 'original-txn-1',
            'productId' => 'alt_uu_premium_monthly',
            'jws' => 'fake-jws',
        ]);

    Device::shouldReceive('getInfo')
        ->andReturn(json_encode(['platform' => 'ios']));

    Http::fake([
        'alt-uu.binota.org/api/iap/verify*' => Http::response([
            'active' => true,
            'product_id' => 'alt_uu_premium_monthly',
            'expires_at' => '2026-09-01T00:00:00+00:00',
            'platform' => 'ios',
        ]),
    ]);

    postJson('/api/subscription/purchase', ['productId' => 'alt_uu_premium_monthly'])
        ->assertCreated()
        ->assertJson(['active' => true, 'productId' => 'alt_uu_premium_monthly']);

    Http::assertSent(function ($request) {
        return $request->url() === 'https://alt-uu.binota.org/api/iap/verify'
            && $request['platform'] === 'ios'
            && $request['transaction_id'] === 'original-txn-1'
            && $request['product_id'] === 'alt_uu_premium_monthly';
    });
});

it('does not contact the backend when the user cancels the purchase', function () {
    seedHunguSessionForSubscription();

    AltUUPlus::shouldReceive('purchase')
        ->once()
        ->andReturn((object) ['status' => 'cancelled']);

    Http::fake();

    postJson('/api/subscription/purchase', ['productId' => 'alt_uu_premium_monthly'])
        ->assertCreated()
        ->assertJson(['active' => false]);

    Http::assertNothingSent();
});

it('validates the product id is present when purchasing', function () {
    seedHunguSessionForSubscription();

    postJson('/api/subscription/purchase', [])->assertUnprocessable();
});

// ──────────────────────────────────────────────────────
// RestorePurchases
// ──────────────────────────────────────────────────────

it('verifies and caches a restored Android purchase', function () {
    seedHunguSessionForSubscription();

    AltUUPlus::shouldReceive('restorePurchases')
        ->once()
        ->andReturn([
            (object) [
                'productIds' => ['alt_uu_premium_monthly'],
                'purchaseToken' => 'token-1',
                'orderId' => 'order-1',
                'isAcknowledged' => true,
                'purchaseState' => 1,
            ],
        ]);

    Device::shouldReceive('getInfo')
        ->andReturn(json_encode(['platform' => 'android']));

    Http::fake([
        'alt-uu.binota.org/api/iap/verify*' => Http::response([
            'active' => true,
            'product_id' => 'alt_uu_premium_monthly',
            'expires_at' => '2026-09-01T00:00:00+00:00',
            'platform' => 'android',
        ]),
    ]);

    postJson('/api/subscription/restore')
        ->assertCreated()
        ->assertJson(['active' => true, 'platform' => 'android']);

    Http::assertSent(function ($request) {
        return $request['purchase_token'] === 'token-1'
            && $request['product_id'] === 'alt_uu_premium_monthly';
    });
});

it('returns inactive when there is nothing to restore', function () {
    seedHunguSessionForSubscription();

    AltUUPlus::shouldReceive('restorePurchases')->once()->andReturn([]);

    postJson('/api/subscription/restore')
        ->assertCreated()
        ->assertJson(['active' => false]);
});

it('reports a cached active entitlement as inactive once its expiry has passed', function () {
    seedHunguSessionForSubscription();

    KeyValueStore::query()->updateOrCreate(
        ['key' => 'subscription:entitlement'],
        ['value' => json_encode([
            'active' => true,
            'productId' => 'alt_uu_premium_monthly',
            'expiresAt' => now()->subMinute()->toIso8601String(),
            'platform' => 'android',
            'reference' => ['purchase_token' => 'token-1', 'product_id' => 'alt_uu_premium_monthly'],
            'checkedAt' => now()->subMonth()->toIso8601String(),
        ])],
    );

    getJson('/api/subscription/status/cached')
        ->assertOk()
        ->assertJson(['active' => false]);
});
