<?php

declare(strict_types=1);

use AltUU\Domains\AppPreference\Actions\GetNouToolsIntegrationEnabled;
use App\Models\Account;
use App\NativeComponents\Courses\SchoolCalendar;
use App\NativeComponents\Courses\Support\SchoolCalendarPresenter;
use App\Services\AccountActiveProfile;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Testing\Native;
use Tests\Feature\Native\Main\MainFixtures;

beforeEach(function (): void {
    Date::setTestNow(Date::parse('2026-05-10 12:00:00', 'Asia/Taipei'));
    MainFixtures::loggedIn();
    MainFixtures::preferences(['nouToolsIntegrationEnabled' => true]);
});

afterEach(function (): void {
    Date::setTestNow();
});

function calendarEvents(): array
{
    return [
        ['name' => '期末考', 'startDate' => '2026-06-20', 'endDate' => '2026-06-21', 'isCountdown' => true],
        ['name' => '選課', 'startDate' => '2026-05-01', 'endDate' => '2026-05-15', 'isCountdown' => false],
        ['name' => '開學', 'startDate' => '2026-02-20', 'endDate' => '2026-02-20', 'isCountdown' => false],
        ['name' => '暑假', 'startDate' => '2026-07-01', 'endDate' => '2026-08-31', 'isCountdown' => false],
    ];
}

it('renders the countdown card and month grouped timeline', function (): void {
    MainFixtures::fakeUpstream(calendar: calendarEvents());

    Native::test(SchoolCalendar::class)
        ->assertSee('期末考')
        ->assertSee('6/20 (週六) - 6/21 (週日)')
        ->assertSee('41')
        ->assertSee('天後')
        ->assertSee('即將開始 / 進行中')
        ->assertSee('2026年5月')
        ->assertSee('選課')
        ->assertSee('進行中')
        ->assertSee('2026年7月')
        ->assertSee('已結束')
        ->assertSee('2026年2月')
        ->assertSee('開學')
        ->assertSee('2/20 (週五)');
});

it('shows an ongoing countdown as 進行中 instead of a day count', function (): void {
    Date::setTestNow(Date::parse('2026-06-20 12:00:00', 'Asia/Taipei'));
    MainFixtures::fakeUpstream(calendar: calendarEvents());

    Native::test(SchoolCalendar::class)->assertSee('期末考')->assertDontSee('天後');
});

it('shows the empty state for an empty calendar', function (): void {
    MainFixtures::fakeUpstream(calendar: []);

    Native::test(SchoolCalendar::class)->assertSee('目前沒有可顯示的學校行事曆。');
});

it('shows a retryable error when NOU Tools is unreachable', function (): void {
    MainFixtures::fakeUpstream(nouToolsDown: true);

    Native::test(SchoolCalendar::class)->assertSee('重試')->assertDontSee('期末考');
});

it('recovers after a failure on retry', function (): void {
    Http::fake([
        'https://nou-tools.binota.org/api/v1/school-calendar' => Http::sequence()
            ->pushFailedConnection()
            ->pushFailedConnection()
            ->pushFailedConnection()
            ->push(calendarEvents()),
    ]);

    Native::test(SchoolCalendar::class)
        ->assertSee('重試')
        ->tap('retry')
        ->assertSee('期末考');
});

it('gates the tab while NOU Tools is off and enables it from the confirm sheet', function (): void {
    MainFixtures::preferences(['nouToolsIntegrationEnabled' => false]);
    MainFixtures::fakeUpstream(calendar: calendarEvents());

    $screen = Native::test(SchoolCalendar::class)
        ->assertSee('此功能需要開啟 NOU 小幫手整合才可使用。')
        ->assertDontSee('期末考');

    expect($screen->get('gateVisible'))->toBeTrue();

    $screen->tap('confirm')->assertSee('期末考');

    expect(app(GetNouToolsIntegrationEnabled::class)())->toBeTrue()
        ->and($screen->get('gateVisible'))->toBeFalse();
});

it('keeps NOU Tools off when the gate is cancelled', function (): void {
    MainFixtures::preferences(['nouToolsIntegrationEnabled' => false]);
    MainFixtures::fakeUpstream(calendar: calendarEvents());

    $screen = Native::test(SchoolCalendar::class)->tap('cancel');

    expect($screen->get('gateVisible'))->toBeFalse()
        ->and(app(GetNouToolsIntegrationEnabled::class)())->toBeFalse();

    $screen->tap('open-gate');
    expect($screen->get('gateVisible'))->toBeTrue();
});

it('sends an unauthenticated user to login', function (): void {
    Account::query()->delete();
    app(AccountActiveProfile::class)->clear();

    Native::test(SchoolCalendar::class)->assertReplacedWith('/native/login');
});

it('falls back to the first ongoing countdown and handles malformed dates', function (): void {
    $result = SchoolCalendarPresenter::present([
        ['name' => 'A', 'startDate' => '2026-05-01', 'endDate' => '2026-05-20', 'isCountdown' => true],
        ['name' => '壞資料', 'startDate' => 'not-a-date', 'endDate' => 'not-a-date', 'isCountdown' => false],
    ], Date::now());

    expect($result['countdown']['name'])->toBe('A')
        ->and($result['countdown']['status'])->toBe('ongoing')
        ->and($result['total'])->toBe(2);
});
