<?php

declare(strict_types=1);

use AltUU\Domains\Subscription\Actions\GetEntitlementStatus;
use AltUU\Domains\Subscription\ViewModels\EntitlementViewModel;
use App\Models\Account;
use App\NativeComponents\Account\AccountPane;
use App\Services\AccountActiveProfile;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Testing\Native;
use Tests\Feature\Native\Fixtures\AccountSeeding;
use Tests\Feature\Native\Main\MainFixtures;

beforeEach(function (): void {
    MainFixtures::loggedIn();
});

function fakeEntitlement(bool $active): void
{
    app()->instance(
        GetEntitlementStatus::class,
        new class($active)
        {
            public function __construct(private bool $active) {}

            public function __invoke(): EntitlementViewModel
            {
                return new EntitlementViewModel($this->active, 'plus', $this->active ? '2027-01-15T00:00:00+00:00' : null, 'ios');
            }
        },
    );
}

it('renders the profile, links and the upsell with sample data for free users', function (): void {
    Http::fake();

    Native::test(AccountPane::class)
        ->assertSee('學生 s1234567')
        ->assertSee('s1234567')
        ->assertSee('切換帳號')
        ->assertSee('我的成績')
        ->assertSee('考試資訊')
        ->assertSee('Alt UU+')
        ->assertSee('解鎖主題色、學習統計等更多功能')
        ->assertSee('升級')
        ->assertSee('學習活動為 Alt UU+ 專屬功能')
        ->assertSee('範例資料')
        ->assertSee('匯入/匯出資料')
        ->assertSee('最長連續');
});

it('navigates to the linked screens', function (string $ref, string $uri): void {
    Native::test(AccountPane::class)->tap($ref)->assertNavigatedTo($uri);
})->with([
    ['switch-account', '/native/courses/account/accounts'],
    ['grades', '/native/courses/account/grades'],
    ['exam-info', '/native/courses/account/exam-info'],
    ['subscription', '/native/courses/account/subscription'],
    ['upgrade', '/native/courses/account/subscription'],
    ['data-export', '/native/courses/account/data-export'],
]);

it('shows the subscriber view with the renewal date and real activity', function (): void {
    fakeEntitlement(true);

    Native::test(AccountPane::class)
        ->assertSee('已訂閱・下次續訂 2027年1月15日')
        ->assertSee('檢視方案')
        ->assertDontSee('範例資料')
        ->assertDontSee('學習活動為 Alt UU+ 專屬功能')
        ->assertDontSee('所有帳號');
});

it('offers the all accounts activity scope with several accounts', function (): void {
    fakeEntitlement(true);
    AccountSeeding::seed('s7654321');
    AccountSeeding::activate(Account::query()->where('username', 's1234567')->firstOrFail());

    $screen = Native::test(AccountPane::class)->assertSee('目前帳號')->assertSee('所有帳號');

    $screen->tap('activity-all');
    expect($screen->get('showAllAccountsActivity'))->toBeTrue();
});

it('hides the Alt UU+ widgets when they are disabled', function (): void {
    MainFixtures::preferences(['altUuPlusDisabled' => true]);

    Native::test(AccountPane::class)
        ->assertSee('我的成績')
        ->assertDontSee('Alt UU+')
        ->assertDontSee('匯入/匯出資料');
});

it('falls back to the cached entitlement when the refresh fails', function (): void {
    app()->instance(
        GetEntitlementStatus::class,
        new class
        {
            public function __invoke(): never
            {
                throw new RuntimeException('offline');
            }
        },
    );

    Native::test(AccountPane::class)->assertSee('升級');
});

it('sends an unauthenticated user to login', function (): void {
    Account::query()->delete();
    app(AccountActiveProfile::class)->clear();

    Native::test(AccountPane::class)->assertReplacedWith('/native/login');
});

it('mounts inside the main tabs layout with a settings action', function (): void {
    Native::visit('/native/courses/account')
        ->assertScreen(AccountPane::class)
        ->assertHasTabBar()
        ->assertTabActive('我的帳號');
});

it('opens settings from the top bar', function (): void {
    Native::test(AccountPane::class)->call('openSettings')->assertNavigatedTo('/native/settings');
});
