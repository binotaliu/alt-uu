<?php

use App\Models\KeyValueStore;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\getJson;
use function Pest\Laravel\patchJson;

beforeEach(function () {
    KeyValueStore::query()->truncate();
});

function seedActiveSubscriptionForPreferences(): void
{
    KeyValueStore::query()->updateOrCreate(
        ['key' => 'subscription:entitlement'],
        ['value' => json_encode([
            'active' => true,
            'productId' => 'alt_uu_premium_monthly',
            'expiresAt' => '2027-01-01T00:00:00+00:00',
            'platform' => 'ios',
            'reference' => null,
        ], JSON_THROW_ON_ERROR)],
    );
}

it('returns default preferences', function () {
    getJson('/api/preferences')
        ->assertOk()
        ->assertExactJson([
            'appearance' => 'system',
            'accentColor' => 'warm',
            'nouToolsIntegrationEnabled' => false,
            'screenReaderEnhancedSupportEnabled' => false,
            'altUuPlusDisabled' => false,
            'onboardingCompleted' => false,
            'liveSessionsTimezone' => 'taiwan',
            'liveSessionNicknameModalEnabled' => true,
            'cellularPlaybackWarningEnabled' => true,
            'whatsNewSeenVersion' => '',
        ]);
});

it('updates only the supplied preference fields and returns the full set', function () {
    patchJson('/api/preferences', ['appearance' => 'dark'])
        ->assertOk()
        ->assertJsonPath('appearance', 'dark')
        ->assertJsonPath('nouToolsIntegrationEnabled', false);

    assertDatabaseHas('key_value_store', [
        'key' => 'preference:appearance',
        'value' => json_encode(['appearance' => 'dark']),
    ]);

    patchJson('/api/preferences', [
        'nouToolsIntegrationEnabled' => true,
        'onboardingCompleted' => true,
    ])
        ->assertOk()
        ->assertExactJson([
            'appearance' => 'dark',
            'accentColor' => 'warm',
            'nouToolsIntegrationEnabled' => true,
            'screenReaderEnhancedSupportEnabled' => false,
            'altUuPlusDisabled' => false,
            'onboardingCompleted' => true,
            'liveSessionsTimezone' => 'taiwan',
            'liveSessionNicknameModalEnabled' => true,
            'cellularPlaybackWarningEnabled' => true,
            'whatsNewSeenVersion' => '',
        ]);

    getJson('/api/preferences')
        ->assertOk()
        ->assertJsonPath('appearance', 'dark')
        ->assertJsonPath('nouToolsIntegrationEnabled', true)
        ->assertJsonPath('onboardingCompleted', true);
});

it('updates every preference field in a single request', function () {
    seedActiveSubscriptionForPreferences();

    patchJson('/api/preferences', [
        'appearance' => 'light',
        'accentColor' => 'ocean',
        'nouToolsIntegrationEnabled' => true,
        'screenReaderEnhancedSupportEnabled' => true,
        'altUuPlusDisabled' => true,
        'onboardingCompleted' => true,
        'liveSessionsTimezone' => 'local',
        'liveSessionNicknameModalEnabled' => false,
        'cellularPlaybackWarningEnabled' => false,
        'whatsNewSeenVersion' => '1.1.0',
    ])
        ->assertOk()
        ->assertExactJson([
            'appearance' => 'light',
            'accentColor' => 'ocean',
            'nouToolsIntegrationEnabled' => true,
            'screenReaderEnhancedSupportEnabled' => true,
            'altUuPlusDisabled' => true,
            'onboardingCompleted' => true,
            'liveSessionsTimezone' => 'local',
            'liveSessionNicknameModalEnabled' => false,
            'cellularPlaybackWarningEnabled' => false,
            'whatsNewSeenVersion' => '1.1.0',
        ]);
});

it('rejects an invalid appearance value', function () {
    patchJson('/api/preferences', ['appearance' => 'ultraviolet'])
        ->assertUnprocessable();
});

it('updates the accent color and persists it', function (string $accentColor) {
    seedActiveSubscriptionForPreferences();

    patchJson('/api/preferences', ['accentColor' => $accentColor])
        ->assertOk()
        ->assertJsonPath('accentColor', $accentColor);

    assertDatabaseHas('key_value_store', [
        'key' => 'preference:accent-color',
        'value' => json_encode(['accentColor' => $accentColor]),
    ]);

    getJson('/api/preferences')->assertJsonPath('accentColor', $accentColor);
    getJson('/api/config')->assertJsonPath('accentColor', $accentColor);
})->with(['warm', 'ocean', 'forest', 'purple', 'pink', 'red', 'grey']);

it('requires an active subscription to pick a non-default accent color', function () {
    patchJson('/api/preferences', ['accentColor' => 'ocean'])
        ->assertStatus(402);

    getJson('/api/preferences')->assertJsonPath('accentColor', 'warm');
});

it('does not partially apply other fields when the accent color is refused', function () {
    patchJson('/api/preferences', ['accentColor' => 'ocean', 'appearance' => 'dark'])
        ->assertStatus(402);

    getJson('/api/preferences')
        ->assertJsonPath('accentColor', 'warm')
        ->assertJsonPath('appearance', 'system');
});

it('lets a non-subscriber go back to the default accent color', function () {
    KeyValueStore::query()->create([
        'key' => 'preference:accent-color',
        'value' => json_encode(['accentColor' => 'ocean']),
    ]);

    patchJson('/api/preferences', ['accentColor' => 'warm'])
        ->assertOk()
        ->assertJsonPath('accentColor', 'warm');
});

it('keeps appearance free without a subscription', function () {
    patchJson('/api/preferences', ['appearance' => 'dark'])
        ->assertOk()
        ->assertJsonPath('appearance', 'dark');
});

it('rejects an invalid accent color value', function () {
    patchJson('/api/preferences', ['accentColor' => 'neon'])
        ->assertUnprocessable();

    getJson('/api/preferences')->assertJsonPath('accentColor', 'warm');
});

it('falls back to the default accent color when the stored value is invalid', function () {
    KeyValueStore::query()->create([
        'key' => 'preference:accent-color',
        'value' => json_encode(['accentColor' => 'neon']),
    ]);

    getJson('/api/preferences')->assertJsonPath('accentColor', 'warm');
});

it('rejects an invalid live sessions timezone value', function () {
    patchJson('/api/preferences', ['liveSessionsTimezone' => 'utc'])
        ->assertUnprocessable();
});

it('reflects alt uu plus and screen reader preferences in app config', function () {
    patchJson('/api/preferences', [
        'altUuPlusDisabled' => true,
        'screenReaderEnhancedSupportEnabled' => true,
    ])->assertOk();

    getJson('/api/config')
        ->assertOk()
        ->assertJsonPath('altUuPlusDisabled', true)
        ->assertJsonPath('screenReaderEnhancedSupportEnabled', true);
});

it('derives the display version from the native version when none is configured', function (?string $nativeVersion, string $expected) {
    config()->set('app.display_version', null);
    config()->set('nativephp.version', $nativeVersion);

    getJson('/api/config')
        ->assertOk()
        ->assertJsonPath('appDisplayVersion', $expected);
})->with([
    'release' => ['1.1.0', 'v1.1.0'],
    'debug' => ['DEBUG', 'DEBUG'],
]);

it('shows the configured display version verbatim', function () {
    config()->set('app.display_version', ' v1.1.0-RC1 ');
    config()->set('nativephp.version', '1.1.0');

    getJson('/api/config')
        ->assertOk()
        ->assertJsonPath('appDisplayVersion', 'v1.1.0-RC1')
        ->assertJsonPath('appVersion', '1.1.0');
});
