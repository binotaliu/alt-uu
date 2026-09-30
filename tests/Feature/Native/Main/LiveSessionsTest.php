<?php

declare(strict_types=1);

use AltUU\Domains\AppPreference\Actions\GetAppPreferences;
use AltUU\Domains\AppPreference\Actions\GetNouToolsIntegrationEnabled;
use App\Models\Account;
use App\NativeComponents\Courses\LiveSessions;
use App\NativeComponents\Courses\Support\LiveSessionPresenter;
use App\Services\AccountActiveProfile;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Testing\Native;
use Tests\Feature\Native\Fixtures\AccountSeeding;
use Tests\Feature\Native\Main\MainFixtures;

beforeEach(function (): void {
    // 2026-05-10 12:00 in Taipei
    Date::setTestNow(Date::parse('2026-05-10 12:00:00', 'Asia/Taipei'));
    MainFixtures::loggedIn();
    MainFixtures::preferences(['nouToolsIntegrationEnabled' => true]);
});

afterEach(function (): void {
    Date::setTestNow();
});

function threeSessions(): array
{
    return [
        ['date' => '2026-05-10', 'startTime' => '11:30:00+08:00', 'endTime' => '12:30:00+08:00'],
        ['date' => '2026-06-14', 'startTime' => '09:00:00+08:00', 'endTime' => '10:50:00+08:00'],
        ['date' => '2026-04-05', 'startTime' => '09:00:00+08:00', 'endTime' => '10:50:00+08:00'],
    ];
}

it('groups sessions into upcoming and ended with month labels and status', function (): void {
    MainFixtures::fakeUpstream(threeSessions());

    Native::test(LiveSessions::class)
        ->assertSee('即將開始 / 進行中')
        ->assertSee('已結束')
        ->assertSee('2026年5月')
        ->assertSee('2026年6月')
        ->assertSee('2026年4月')
        ->assertSee('管理學：導論')
        ->assertSee('進行中')
        ->assertSee('05/10')
        ->assertSee('週日')
        ->assertSee('11:30 - 12:30')
        ->assertSee('王小明老師')
        ->assertSee('上午班')
        ->assertSee('進入教室')
        ->assertSee('備用教室');
});

it('shows the empty state when there are no sessions', function (): void {
    MainFixtures::fakeUpstream([]);

    Native::test(LiveSessions::class)->assertSee('目前沒有可顯示的視訊面授班級資訊。');
});

it('shows the per-group empty message when one group has nothing', function (): void {
    MainFixtures::fakeUpstream([['date' => '2026-06-14', 'startTime' => '09:00:00+08:00', 'endTime' => '10:50:00+08:00']]);

    Native::test(LiveSessions::class)->assertSee('目前沒有已結束的視訊面授。');
});

it('recovers after a NOU Tools failure', function (): void {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response(['code' => 0, 'message' => 'success', 'data' => ['username' => 's1234567', 'realname' => '測試學生']]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response(['code' => 0, 'data' => ['list' => [['course_id' => '1001', 'title' => '(114上)管理學：導論-ZZZ001班']]]]),
        'https://nou-tools.binota.org/api/v1/courses?term=2025A' => Http::sequence()
            ->pushFailedConnection()
            ->pushFailedConnection()
            ->pushFailedConnection()
            ->push([['id' => 1234, 'name' => '管理學導論', 'term' => '2025A']]),
        'https://nou-tools.binota.org/api/v1/courses/1234' => Http::response([
            'id' => 1234, 'name' => '管理學導論', 'term' => '2025A',
            'classes' => [['code' => 'ZZZ001', 'typeLabel' => '上午班', 'teacherName' => '王老師', 'link' => 'https://meet.example.com/main', 'sessions' => [['date' => '2026-06-14', 'startTime' => '09:00:00+08:00', 'endTime' => '10:50:00+08:00']]]],
        ]),
    ]);

    Native::test(LiveSessions::class)
        ->assertSee('重試')
        ->assertDontSee('2026年6月')
        ->tap('retry')
        ->assertSee('2026年6月');
});

it('opens the nickname reminder before entering the classroom and then the browser', function (): void {
    MainFixtures::fakeUpstream(threeSessions());
    $accountId = app(AccountActiveProfile::class)->get();
    $key = LiveSessionPresenter::tapKey("{$accountId}-1001-ZZZ001-2026-05-10-11:30:00+08:00");

    $screen = Native::test(LiveSessions::class)->tap("enter-{$key}");

    expect($screen->get('nicknameSheetVisible'))->toBeTrue()
        ->and($screen->get('pendingNickname'))->toBe('s1234567 學生 s1234567')
        ->and($screen->get('pendingEmail'))->toBe('s1234567@webmail.nou.edu.tw')
        ->and($screen->get('pendingUrl'))->toBe('https://meet.example.com/main');

    $screen->tap('nickname-enter')
        ->assertNativeCalled('Browser.Open', fn (array $params): bool => $params['url'] === 'https://meet.example.com/main');

    expect($screen->get('nicknameSheetVisible'))->toBeFalse();
});

it('opens the backup classroom link', function (): void {
    MainFixtures::fakeUpstream(threeSessions());
    $accountId = app(AccountActiveProfile::class)->get();
    $key = LiveSessionPresenter::tapKey("{$accountId}-1001-ZZZ001-2026-05-10-11:30:00+08:00");

    $screen = Native::test(LiveSessions::class)->tap("backup-{$key}");

    expect($screen->get('pendingUrl'))->toBe('https://meet.example.com/backup');
});

it('opens the classroom straight away when the nickname reminder is disabled', function (): void {
    MainFixtures::preferences(['liveSessionNicknameModalEnabled' => false]);
    MainFixtures::fakeUpstream(threeSessions());
    $accountId = app(AccountActiveProfile::class)->get();
    $key = LiveSessionPresenter::tapKey("{$accountId}-1001-ZZZ001-2026-05-10-11:30:00+08:00");

    $screen = Native::test(LiveSessions::class)->tap("enter-{$key}");

    expect($screen->get('nicknameSheetVisible'))->toBeFalse();
    $screen->assertNativeCalled('Browser.Open', fn (array $params): bool => $params['url'] === 'https://meet.example.com/main');
});

it('can dismiss the nickname reminder without opening the browser', function (): void {
    MainFixtures::fakeUpstream(threeSessions());
    $accountId = app(AccountActiveProfile::class)->get();
    $key = LiveSessionPresenter::tapKey("{$accountId}-1001-ZZZ001-2026-05-10-11:30:00+08:00");

    $screen = Native::test(LiveSessions::class)->tap("enter-{$key}")->tap('nickname-cancel');

    expect($screen->get('nicknameSheetVisible'))->toBeFalse();
    $screen->assertNativeNotCalled('Browser.Open');
});

it('gates the tab while NOU Tools is off and enables it from the confirm sheet', function (): void {
    MainFixtures::preferences(['nouToolsIntegrationEnabled' => false]);
    MainFixtures::fakeUpstream(threeSessions());

    $screen = Native::test(LiveSessions::class)
        ->assertSee('此功能需要開啟 NOU 小幫手整合才可使用。')
        ->assertDontSee('2026年6月');

    expect($screen->get('gateVisible'))->toBeTrue();

    $screen->tap('confirm');

    expect($screen->get('gateVisible'))->toBeFalse()
        ->and(app(GetNouToolsIntegrationEnabled::class)())->toBeTrue();

    $screen->assertSee('2026年6月');
});

it('keeps the gate when the user cancels and lets them reopen it', function (): void {
    MainFixtures::preferences(['nouToolsIntegrationEnabled' => false]);
    MainFixtures::fakeUpstream(threeSessions());

    $screen = Native::test(LiveSessions::class)->tap('cancel');

    expect($screen->get('gateVisible'))->toBeFalse()
        ->and(app(GetNouToolsIntegrationEnabled::class)())->toBeFalse();

    $screen->tap('open-gate');
    expect($screen->get('gateVisible'))->toBeTrue();
});

it('offers the all accounts scope only with several accounts and loads both', function (): void {
    MainFixtures::fakeUpstream(threeSessions());

    Native::test(LiveSessions::class)->assertDontSee('所有帳號');

    $second = AccountSeeding::seed('s7654321', nickname: '副帳號');
    AccountSeeding::activate(Account::query()->where('username', 's1234567')->firstOrFail());

    $screen = Native::test(LiveSessions::class)->assertSee('目前帳號')->assertSee('所有帳號')->assertDontSee('副帳號');

    $screen->tap('scope-all')->assertSee('副帳號');
    expect($screen->get('showAllAccounts'))->toBeTrue();

    $screen->tap('scope-current')->assertDontSee('副帳號');
    expect($second->id)->not->toBeNull();
});

it('lets a traveller pick the time zone and saves it', function (): void {
    date_default_timezone_set('America/New_York');

    try {
        MainFixtures::fakeUpstream(threeSessions());

        $screen = Native::test(LiveSessions::class)
            ->assertSee('選擇顯示的時區')
            ->assertSee('America/New_York')
            ->assertSee('11:30 - 12:30');

        $screen->tap('timezone-local')->assertSee('23:30 - 00:30')->assertSee('05/09');

        expect(app(GetAppPreferences::class)()->liveSessionsTimezone)->toBe('local');
    } finally {
        date_default_timezone_set('UTC');
    }
});

it('hides the time zone selector on a Taiwan device or when the zone is unknown', function (): void {
    MainFixtures::fakeUpstream(threeSessions());

    Native::test(LiveSessions::class)->assertDontSee('選擇顯示的時區');

    date_default_timezone_set('Asia/Taipei');

    try {
        Native::test(LiveSessions::class)->assertDontSee('選擇顯示的時區');
    } finally {
        date_default_timezone_set('UTC');
    }
});

it('sends an unauthenticated user to login', function (): void {
    Account::query()->delete();
    app(AccountActiveProfile::class)->clear();

    Native::test(LiveSessions::class)->assertReplacedWith('/native/login');
});

it('opens the session picker instead of an error when the session dies mid-use', function (): void {
    MainFixtures::fakeUpstream(threeSessions());
    $second = AccountSeeding::seed('s7654321');
    AccountSeeding::activate(Account::query()->where('username', 's1234567')->firstOrFail());

    $screen = Native::test(LiveSessions::class);

    app(UUSessionStore::class)->forget();
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response(['code' => 403, 'message' => 'Auth fail', 'data' => []]),
    ]);

    $screen->call('onResume');

    expect($screen->get('sessionPickerVisible'))->toBeTrue()
        ->and($second->id)->not->toBeNull();
});

it('formats the presenter output for a Taiwan device', function (): void {
    $result = LiveSessionPresenter::present([[
        'accountId' => 1, 'accountLabel' => '主帳號', 'courseId' => '1', 'courseName' => '課', 'className' => null, 'classCode' => 'A',
        'typeLabel' => null, 'teacherName' => null, 'link' => null, 'backupClassroomUrl' => null,
        'sessions' => [['date' => '2026-05-11', 'startTime' => '09:00:00', 'endTime' => '10:00:00']],
    ]], 'taiwan', 'UTC', Date::now());

    $session = $result['upcoming'][0]['sessions'][0];

    expect($session['className'])->toBe('未提供班級名稱')
        ->and($session['typeLabel'])->toBe('未知班別')
        ->and($session['teacher'])->toBe('未提供')
        ->and($session['startClock'])->toBe('09:00')
        ->and($session['weekday'])->toBe('週一')
        ->and(LiveSessionPresenter::formatUtcOffset(-330))->toBe('UTC-05:30');
});
