<?php

declare(strict_types=1);

use AltUU\Domains\Account\Exceptions\PremiumRequiredException;
use AltUU\Domains\AppPreference\Actions\GetAppPreferences;
use AltUU\Domains\AppPreference\Actions\UpdateAppPreferences;
use AltUU\Domains\AppPreference\AppPreferenceStore;
use AltUU\Domains\Subscription\SubscriptionEntitlementStore;
use App\Models\AttachmentDownload;
use App\NativeComponents\Settings\SettingsIndex;
use Illuminate\Support\Facades\Storage;
use Native\Mobile\Testing\Native;
use Native\Mobile\UI\Theme;
use Tests\Feature\Native\Fixtures\AccountSeeding;

function activateSubscription(): void
{
    app(SubscriptionEntitlementStore::class)->put(true, 'plus', now()->addYear()->toIso8601String(), 'ios', null);
}

it('renders without a session and shows stored preferences', function (): void {
    app(AppPreferenceStore::class)->setNouToolsIntegrationEnabled(true);

    Native::visit('/settings')
        ->assertScreen(SettingsIndex::class)
        ->assertSee('外觀')
        ->assertSee('開啟 NOU 小幫手整合')
        ->assertSee('清除已下載附件')
        ->assertSee('連線診斷')
        ->assertSee('聯絡資訊與政策')
        ->assertNavTitle('設定')
        ->assertSet('nouToolsIntegrationEnabled', true)
        ->assertDontSee('查看');
});

it('hides the material source link unless the dev flag is on', function (): void {
    config()->set('app.material_source_viewer_enabled', false);
    Native::test(SettingsIndex::class)->assertDontSee('教材來源檢視');

    config()->set('app.material_source_viewer_enabled', true);
    Native::test(SettingsIndex::class)
        ->assertSee('教材來源檢視')
        ->tap('open-material-source')
        ->assertNavigatedTo('/settings/diagnostics/material');
});

it('saves a toggle through the preference action', function (): void {
    Native::test(SettingsIndex::class)
        ->call('savePreference', 'nouToolsIntegrationEnabled', true)
        ->assertSet('nouToolsIntegrationEnabled', true)
        ->assertSet('savingKey', '');

    expect(app(GetAppPreferences::class)()->nouToolsIntegrationEnabled)->toBeTrue();
});

it('keeps the old value and toasts when a preference cannot be saved', function (): void {
    $test = Native::test(SettingsIndex::class);

    app()->bind(UpdateAppPreferences::class, fn () => throw new RuntimeException('disk full'));

    $test->call('savePreference', 'cellularPlaybackWarningEnabled', false)
        ->assertSet('cellularPlaybackWarningEnabled', true)
        ->assertSet('savingKey', '')
        ->assertNativeCalled('Dialog.Toast', fn (array $p): bool => $p['message'] === '儲存設定失敗，請稍後再試。');
});

it('ignores unknown preference keys', function (): void {
    Native::test(SettingsIndex::class)
        ->call('savePreference', 'onboardingCompleted', true)
        ->assertSet('savingKey', '');

    expect(app(GetAppPreferences::class)()->onboardingCompleted)->toBeFalse();
});

it('saves the appearance choice', function (): void {
    Native::test(SettingsIndex::class)
        ->tap('appearance-dark')
        ->assertSet('appearance', 'dark');

    expect(app(GetAppPreferences::class)()->appearance)->toBe('dark');
});

it('applies the stored accent to the theme on mount', function (): void {
    app(AppPreferenceStore::class)->setAccentColor('ocean');

    Native::test(SettingsIndex::class)->assertSet('accentColor', 'ocean');

    expect(config('native-ui.theme.light.primary'))->toBe(config('native-ui.accents.ocean.light.primary'));
})->afterEach(fn () => Theme::reset());

it('draws every accent swatch', function (): void {
    $test = Native::test(SettingsIndex::class);

    foreach (array_keys(config('native-ui.accents')) as $id) {
        $test->assertElement('pressable', fn ($el) => ($el['ref'] ?? null) === "accent-{$id}");
    }
});

it('paints swatches with each accent colour', function (): void {
    $hex = strtoupper(ltrim((string) config('native-ui.accents.ocean.light.accent'), '#'));

    Native::test(SettingsIndex::class)
        ->assertElement('column', fn ($el) => strtoupper((string) ($el['style']['bg_color'] ?? '')) === "#{$hex}");
});

it('refuses a non-default accent without accounts', function (): void {
    Native::test(SettingsIndex::class)
        ->tap('accent-ocean')
        ->assertSet('accentColor', 'warm')
        ->assertNativeCalled('Dialog.Toast', fn (array $p): bool => str_contains($p['message'], '登入並訂閱 Alt UU+'))
        ->assertNoNavigation();
});

it('sends an unsubscribed user to the subscription screen', function (): void {
    AccountSeeding::activate(AccountSeeding::seed('s1111111'));

    Native::test(SettingsIndex::class)
        ->assertSet('hasAccounts', true)
        ->tap('accent-ocean')
        ->assertNavigatedTo('/courses/account/subscription')
        ->assertSet('accentColor', 'warm');

    expect(app(GetAppPreferences::class)()->accentColor)->toBe('warm');
});

it('lets a subscriber pick an accent and pushes it to the theme', function (): void {
    AccountSeeding::activate(AccountSeeding::seed('s1111111'));
    activateSubscription();

    Native::test(SettingsIndex::class)
        ->assertSet('subscriptionActive', true)
        ->tap('accent-forest')
        ->assertSet('accentColor', 'forest')
        ->assertNoNavigation();

    expect(app(GetAppPreferences::class)()->accentColor)->toBe('forest')
        ->and(config('native-ui.theme.light.primary'))->toBe(config('native-ui.accents.forest.light.primary'));
})->afterEach(fn () => Theme::reset());

it('redirects to the subscription screen when the backend answers 402', function (): void {
    AccountSeeding::activate(AccountSeeding::seed('s1111111'));
    activateSubscription();

    $test = Native::test(SettingsIndex::class);

    app()->bind(UpdateAppPreferences::class, fn () => throw new PremiumRequiredException);

    $test->tap('accent-red')
        ->assertNavigatedTo('/courses/account/subscription')
        ->assertSet('accentColor', 'warm')
        ->assertSet('subscriptionActive', false);
});

it('always lets the user return to the default accent', function (): void {
    app(AppPreferenceStore::class)->setAccentColor('pink');

    Native::test(SettingsIndex::class)
        ->tap('accent-warm')
        ->assertSet('accentColor', 'warm')
        ->assertNoNavigation();
})->afterEach(fn () => Theme::reset());

it('hides the accent picker when Alt UU+ is disabled', function (): void {
    app(AppPreferenceStore::class)->setAltUuPlusDisabled(true);

    Native::test(SettingsIndex::class)
        ->assertSet('altUuPlusDisabled', true)
        ->assertMissingElement('pressable', fn ($el) => ($el['ref'] ?? null) === 'accent-ocean');
});

it('reveals the build number after five quick taps', function (): void {
    config()->set('nativephp.version_code', '77');

    $test = Native::test(SettingsIndex::class)->assertDontSee('(77)');

    foreach (range(1, 4) as $_) {
        $test->tap('app-version');
    }

    $test->assertDontSee('(77)')->tap('app-version')->assertSet('buildNumberRevealed', true)->assertSee('(77)');
});

it('restarts the tap count when the taps are too slow', function (): void {
    $test = Native::test(SettingsIndex::class);

    foreach (range(1, 4) as $_) {
        $test->tap('app-version');
    }

    $test->set('versionLastTapAt', microtime(true) - 3)
        ->tap('app-version')
        ->assertSet('buildNumberRevealed', false)
        ->assertSet('versionTapCount', 1);
});

it('starts and stops the diagnostic recording window', function (): void {
    Native::test(SettingsIndex::class)
        ->assertSee('紀錄診斷紀錄以協助瞭解問題')
        ->call('setRecording', true)
        ->assertSee('記錄中，約')
        ->assertNotSet('recordingExpiresAt', null)
        ->call('setRecording', false)
        ->assertSet('recordingExpiresAt', null)
        ->assertDontSee('記錄中，約');
});

it('links to the diagnostics screens', function (): void {
    Native::test(SettingsIndex::class)
        ->tap('open-diagnostics')
        ->assertNavigatedTo('/settings/diagnostics');

    Native::test(SettingsIndex::class)
        ->tap('open-diagnostic-log')
        ->assertNavigatedTo('/settings/diagnostics/log');
});

it('opens What is new through the shared sheet', function (): void {
    Native::test(SettingsIndex::class)
        ->assertElement('bottom_sheet', fn ($el) => ($el['props']['visible'] ?? null) === false)
        ->tap('whats-new')
        ->assertElement('bottom_sheet', fn ($el) => ($el['props']['visible'] ?? null) === true)
        ->dismissSheet('whats-new')
        ->assertSet('whatsNewVisible', false);
});

it('opens terms, privacy, source and mail links', function (): void {
    $test = Native::test(SettingsIndex::class);

    $test->tap('terms')->assertNativeCalled('Browser.OpenInApp', fn (array $p): bool => str_ends_with($p['url'], '/usage-policy'));
    $test->tap('privacy')->assertNativeCalled('Browser.OpenInApp', fn (array $p): bool => str_ends_with($p['url'], '/privacy-policy'));
    $test->tap('source-code')->assertNativeCalled('Browser.OpenInApp', fn (array $p): bool => $p['url'] === 'https://github.com/binotaliu/alt-uu');
    $test->tap('contact')->assertNativeCalled('Browser.Open', fn (array $p): bool => $p['url'] === 'mailto:alt-uu-contact@binota.org');
});

it('confirms before clearing downloaded attachments and reports the result', function (): void {
    Storage::fake('local');
    Storage::disk('local')->put('attachments/1.pdf', 'x');
    AttachmentDownload::query()->create([
        'source_url' => 'https://uu.nou.edu.tw/file/1.pdf',
        'cid' => 'C1',
        'file_name' => '1.pdf',
        'status' => AttachmentDownload::STATUS_COMPLETED,
        'relative_path' => 'attachments/1.pdf',
    ]);

    $test = Native::test(SettingsIndex::class)->tap('clear-attachments');
    $test->assertNativeCalled('Dialog.Alert');

    Storage::disk('local')->assertExists('attachments/1.pdf');

    $test->call('handleDialogButtonPressed', 1, '清除', 'confirm:clear-attachments')
        ->assertSee('已清除 1 個檔案（共更新 1 筆下載紀錄）。');

    Storage::disk('local')->assertMissing('attachments/1.pdf');
});

it('does nothing when the clear dialog is cancelled', function (): void {
    Native::test(SettingsIndex::class)
        ->tap('clear-attachments')
        ->call('handleDialogButtonPressed', 0, '取消', 'confirm:clear-attachments')
        ->assertSet('attachmentCleanupSummary', null);
});
