<?php

use App\Models\Account;
use App\Models\KeyValueStore;
use App\Services\AccountActiveProfile;
use App\Services\AccountCredentialsStore;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    KeyValueStore::query()->truncate();
});

/**
 * Settings is reachable logged out, but Alt UU+ status is only looked up for a logged-in user.
 */
function loginForSettingsTests(): void
{
    Http::fake([
        'alt-uu.binota.org/api/iap/entitlement*' => Http::response(['active' => false, 'platform' => 'ios']),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['username' => 's1234567', 'realname' => '測試學生', 'picture' => ''],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['list' => []],
        ]),
        '*' => Http::response('<html><body></body></html>'),
    ]);

    app(AccountCredentialsStore::class)->put('s1234567', 'test-password');

    $account = Account::query()->where('username', 's1234567')->firstOrFail();

    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-a',
        'session_idx' => 'idx-a',
        'cookies' => ['WM' => 'cookie-a'],
        'profile' => [
            'display_name' => '測試學生',
            'username' => 's1234567',
            'picture' => '',
            'realname' => '測試學生',
        ],
    ], $account->id);

    app(AccountActiveProfile::class)->set($account->id);

    // The first page load only runs the app-boot session validation and
    // sets the boot cookie, which the guarded API calls need afterwards.
    visit('/courses')->assertPathIs('/courses');
}

/**
 * @param  array<string, mixed>|null  $reference
 */
function seedSubscriptionForSettingsTests(bool $active, ?array $reference = null): void
{
    KeyValueStore::query()->updateOrCreate(
        ['key' => 'subscription:entitlement'],
        ['value' => json_encode([
            'active' => $active,
            'productId' => 'alt_uu_premium_monthly',
            'expiresAt' => '2027-01-01T00:00:00+00:00',
            'platform' => 'ios',
            'reference' => $reference,
        ], JSON_THROW_ON_ERROR)],
    );
}

it('shows the settings page with its preference sections', function () {
    visit('/settings')
        ->assertSee('設定')
        ->assertSee('外觀')
        ->assertSee('開啟 NOU 小幫手整合')
        ->assertSee('關閉 Alt UU+ 功能');
});

it('changes the appearance preference and persists it', function () {
    visit('/settings')
        ->click('深色')
        ->assertScript('document.documentElement.classList.contains("dark")', true);

    expect(
        KeyValueStore::query()->where('key', 'preference:appearance')->value('value'),
    )->toBe(json_encode(['appearance' => 'dark']));

    // Reloading should reflect the persisted preference.
    visit('/settings')
        ->assertScript('document.documentElement.classList.contains("dark")', true);
});

it('changes the accent color and persists it for a subscriber', function () {
    loginForSettingsTests();
    seedSubscriptionForSettingsTests(active: true);

    visit('/settings')
        ->assertScript('document.documentElement.dataset.accent', 'warm')
        ->click('[data-testid="accent-ocean"]')
        ->assertScript('document.documentElement.dataset.accent', 'ocean')
        ->assertAttribute('[data-testid="accent-ocean"]', 'aria-pressed', 'true');

    expect(
        KeyValueStore::query()->where('key', 'preference:accent-color')->value('value'),
    )->toBe(json_encode(['accentColor' => 'ocean']));

    // Server-rendered on first paint after a reload.
    visit('/settings')
        ->assertScript('document.documentElement.dataset.accent', 'ocean')
        ->assertAttribute('[data-testid="accent-ocean"]', 'aria-pressed', 'true')
        ->assertAttribute('[data-testid="accent-warm"]', 'aria-pressed', 'false');
});

it('does not change the accent color while logged out', function () {
    visit('/settings')
        ->click('[data-testid="accent-ocean"]')
        ->assertSee('登入並訂閱 Alt UU+')
        ->assertPathIs('/settings')
        ->assertScript('document.documentElement.dataset.accent', 'warm');
});

it('sends a non-subscriber to the subscription page instead of changing the accent color', function () {
    loginForSettingsTests();
    seedSubscriptionForSettingsTests(active: false);

    visit('/settings')
        ->click('[data-testid="accent-ocean"]')
        ->waitForText('Alt UU+')
        ->assertPathIs('/courses/account/subscription')
        ->assertScript('document.documentElement.dataset.accent', 'warm');

    expect(
        KeyValueStore::query()->where('key', 'preference:accent-color')->exists(),
    )->toBeFalse();
});

it('falls back to the default accent color once the subscription is reported inactive', function () {
    loginForSettingsTests();
    seedSubscriptionForSettingsTests(
        active: true,
        reference: ['transaction_id' => 'original-txn-1', 'product_id' => 'alt_uu_premium_monthly'],
    );
    KeyValueStore::query()->create([
        'key' => 'preference:accent-color',
        'value' => json_encode(['accentColor' => 'ocean']),
    ]);

    visit('/settings')
        ->waitForEvent('networkidle')
        ->assertAttribute('[data-testid="accent-warm"]', 'aria-pressed', 'true')
        ->assertScript('document.documentElement.dataset.accent', 'warm');

    expect(
        KeyValueStore::query()->where('key', 'preference:accent-color')->value('value'),
    )->toBe(json_encode(['accentColor' => 'warm']));
});

it('toggles the NOU tools integration preference and persists it', function () {
    visit('/settings')
        ->click('切換 NOU 小幫手整合');

    expect(
        KeyValueStore::query()->where('key', 'preference:nou-tools-integration')->value('value'),
    )->toBe(json_encode(['enabled' => true]));
});

it('tells the Android status bar to use icons that contrast with the chosen appearance', function () {
    $page = visit('/settings');
    $page->script('window.statusBarStyles = []; window.AndroidBridge = { setStatusBarStyle: (style) => window.statusBarStyles.push(style) };');

    $page->click('淺色')
        ->assertScript('window.statusBarStyles.at(-1)', 'dark')
        ->click('深色')
        ->assertScript('window.statusBarStyles.at(-1)', 'light');
});

it('hides the accent color picker when Alt UU+ features are hidden', function () {
    KeyValueStore::query()->updateOrCreate(
        ['key' => 'preference:alt-uu-plus-disabled'],
        ['value' => json_encode(['disabled' => true], JSON_THROW_ON_ERROR)],
    );

    visit('/settings')
        ->assertSee('外觀')
        ->assertMissing('[data-testid="accent-ocean"]');
});

it('hides the build number until the display version is tapped several times', function () {
    $hasBuildNumber = 'document.querySelector(\'[data-testid="app-version"]\').textContent.includes("(")';

    $page = visit('/settings')
        ->assertScript($hasBuildNumber, false);

    foreach (range(1, 4) as $ignored) {
        $page->click('[data-testid="app-version"]');
    }

    $page->assertScript($hasBuildNumber, false)
        ->click('[data-testid="app-version"]')
        ->assertScript($hasBuildNumber, true);
});
