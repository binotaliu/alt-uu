<?php

declare(strict_types=1);

use AltUU\Domains\AppPreference\Actions\GetAppPreferences;
use AltUU\Domains\AppPreference\Actions\UpdateAppPreferences;
use AltUU\Domains\AppPreference\DataTransferObjects\UpdateAppPreferencesInputData;
use App\NativeComponents\Auth\Onboarding;
use Native\Mobile\Testing\Native;
use Tests\Feature\Native\Fixtures\AccountSeeding;

it('starts on the first slide', function (): void {
    Native::test(Onboarding::class)
        ->assertSee('歡迎使用 Alt UU')
        ->assertSee('1 / 3')
        ->assertSee('這是什麼 App？')
        ->assertSee('繼續')
        ->assertElement('button', fn (array $node): bool => ($node['props']['label'] ?? null) === '上一頁'
            && ($node['props']['disabled'] ?? false) === true)
        ->assertMissingElement('webview');
});

it('walks the slides with the buttons', function (): void {
    Native::test(Onboarding::class)
        ->tap('continue')
        ->assertSee('2 / 3')
        ->assertSee('保存學習時數')
        ->assertSee('12:34')
        ->tap('continue')
        ->assertSee('3 / 3')
        ->assertSee('NOU 小幫手整合')
        ->assertSee('開始使用')
        ->tap('back')
        ->assertSet('currentSlide', 1);
});

it('jumps through the page dots and swipes', function (): void {
    Native::test(Onboarding::class)
        ->tap('dot-2')
        ->assertSet('currentSlide', 2)
        ->swipe('slides', 'right')
        ->assertSet('currentSlide', 1)
        ->swipe('slides', 'left')
        ->swipe('slides', 'left')
        ->assertSet('currentSlide', 2)
        ->swipe('slides', 'up')
        ->assertSet('currentSlide', 2);

    Native::test(Onboarding::class)->swipe('slides', 'right')->assertSet('currentSlide', 0);
});

it('saves the NOU Tools switch immediately', function (): void {
    $screen = Native::test(Onboarding::class)->set('currentSlide', 2)
        ->call('setNouToolsIntegration', true)
        ->assertSet('nouToolsIntegrationEnabled', true)
        ->assertSet('errorMessage', null);

    expect(app(GetAppPreferences::class)()->nouToolsIntegrationEnabled)->toBeTrue();

    $screen->call('setNouToolsIntegration', false)->assertSet('nouToolsIntegrationEnabled', false);

    expect(app(GetAppPreferences::class)()->nouToolsIntegrationEnabled)->toBeFalse();
});

it('reflects an already saved NOU Tools preference', function (): void {
    app(UpdateAppPreferences::class)(
        UpdateAppPreferencesInputData::from(['nouToolsIntegrationEnabled' => true]),
    );

    Native::test(Onboarding::class)->assertSet('nouToolsIntegrationEnabled', true);
});

it('completes onboarding and continues to login when no account exists', function (): void {
    config(['nativephp.version' => '9.9.9']);

    Native::test(Onboarding::class)
        ->set('currentSlide', 2)
        ->tap('continue')
        ->assertReplacedWith('/native/login');

    $preferences = app(GetAppPreferences::class)();

    expect($preferences->onboardingCompleted)->toBeTrue()
        ->and($preferences->whatsNewSeenVersion)->toBe('9.9.9');
});

it('completes onboarding and continues to the courses when an account exists', function (): void {
    AccountSeeding::seed('s1234567');

    Native::test(Onboarding::class)
        ->set('currentSlide', 2)
        ->tap('continue')
        ->assertReplacedWith('/native/courses');
});

it('stays put and shows an error when saving fails', function (): void {
    $screen = Native::test(Onboarding::class)->set('currentSlide', 2);

    app()->bind(UpdateAppPreferences::class, fn () => throw new RuntimeException('disk full'));

    $screen->tap('continue')
        ->assertSee('儲存 onboarding 狀態失敗，請稍後再試。')
        ->assertSet('savingOnboarding', false)
        ->assertNoNavigation();
});

it('reverts the NOU Tools switch with a message when saving fails', function (): void {
    $screen = Native::test(Onboarding::class)->set('currentSlide', 2);

    app()->bind(UpdateAppPreferences::class, fn () => throw new RuntimeException('disk full'));

    $screen->call('setNouToolsIntegration', true)
        ->assertSet('nouToolsIntegrationEnabled', false)
        ->assertSee('更新 NOU 小幫手整合失敗，請稍後再試。');
});
