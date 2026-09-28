<?php

use App\Models\Account;
use App\Models\AccountDailyActivity;
use App\Services\AccountActiveProfile;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Date;
use Illuminate\Testing\TestResponse;
use Mockery as MockeryManager;

use function Pest\Laravel\withCookie;

function mockHunguSession(): void
{
    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試', 'username' => 's123'],
    ]);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);
}

function fetchActivity(bool $allAccounts = false): TestResponse
{
    return withCookie(config('hungu.app_boot_cookie_name'), '1')
        ->getJson('/api/accounts/activity?allAccounts='.($allAccounts ? '1' : '0'));
}

it('computes current streak, longest streak, and longest study day from daily activity', function () {
    Date::setTestNow(Date::parse('2026-07-11 12:00:00', 'Asia/Taipei'));

    $account = Account::factory()->create();
    app(AccountActiveProfile::class)->set($account->id);
    mockHunguSession();

    $seconds = [
        '2026-07-01' => 1000,
        '2026-07-02' => 2000,
        '2026-07-03' => 9000,
        '2026-07-04' => 1500,
        '2026-07-05' => 1800,
        '2026-07-10' => 1200,
        '2026-07-11' => 600,
    ];

    foreach ($seconds as $date => $total) {
        AccountDailyActivity::factory()->create([
            'account_id' => $account->id,
            'activity_date' => $date,
            'total_seconds' => $total,
        ]);
    }

    $response = fetchActivity();

    $response->assertSuccessful();
    $response->assertJsonPath('currentStreak', 2);
    $response->assertJsonPath('longestStreak', 5);
    $response->assertJsonPath('longestStudyDayDate', '2026-07-03');
    $response->assertJsonPath('longestStudyDaySeconds', 9000);

    $rangeStart = Date::parse('2026-07-11', 'Asia/Taipei')->subMonths(6)->addDay();
    $rangeEnd = Date::parse('2026-07-11', 'Asia/Taipei');
    $expectedDayCount = $rangeStart->diffInDays($rangeEnd) + 1;

    $response->assertJsonCount($expectedDayCount, 'days');
    $response->assertJsonPath('days.0.date', $rangeStart->toDateString());
    $response->assertJsonPath(sprintf('days.%d.date', $expectedDayCount - 1), $rangeEnd->toDateString());
    $response->assertJsonPath('hasMultipleAccounts', false);

    Date::setTestNow();
});

it('combines every accounts daily activity when allAccounts is requested', function () {
    Date::setTestNow(Date::parse('2026-07-11 12:00:00', 'Asia/Taipei'));

    $account = Account::factory()->create();
    $otherAccount = Account::factory()->create();
    app(AccountActiveProfile::class)->set($account->id);
    mockHunguSession();

    AccountDailyActivity::factory()->create([
        'account_id' => $account->id,
        'activity_date' => '2026-07-10',
        'total_seconds' => 1000,
    ]);
    AccountDailyActivity::factory()->create([
        'account_id' => $otherAccount->id,
        'activity_date' => '2026-07-10',
        'total_seconds' => 500,
    ]);
    AccountDailyActivity::factory()->create([
        'account_id' => $otherAccount->id,
        'activity_date' => '2026-07-11',
        'total_seconds' => 300,
    ]);

    $response = fetchActivity(allAccounts: true);

    $response->assertSuccessful();
    $response->assertJsonPath('hasMultipleAccounts', true);
    $response->assertJsonPath('days.'.array_search('2026-07-10', array_column($response->json('days'), 'date'), true).'.seconds', 1500);
    $response->assertJsonPath('days.'.array_search('2026-07-11', array_column($response->json('days'), 'date'), true).'.seconds', 300);

    Date::setTestNow();
});

it('does not leak another accounts daily activity', function () {
    Date::setTestNow(Date::parse('2026-07-11 12:00:00', 'Asia/Taipei'));

    $account = Account::factory()->create();
    $otherAccount = Account::factory()->create();
    app(AccountActiveProfile::class)->set($account->id);
    mockHunguSession();

    AccountDailyActivity::factory()->create([
        'account_id' => $otherAccount->id,
        'activity_date' => '2026-07-11',
        'total_seconds' => 5000,
    ]);

    $response = fetchActivity();

    $response->assertSuccessful();
    $response->assertJsonPath('currentStreak', 0);
    $response->assertJsonPath('longestStreak', 0);
    $response->assertJsonPath('longestStudyDaySeconds', 0);
    $response->assertJsonPath('longestStudyDayDate', null);

    Date::setTestNow();
});

it('returns an empty heatmap when no account is active', function () {
    Date::setTestNow(Date::parse('2026-07-11 12:00:00', 'Asia/Taipei'));

    mockHunguSession();

    $response = fetchActivity();

    $response->assertSuccessful();
    $response->assertJsonPath('currentStreak', 0);
    $response->assertJsonPath('longestStreak', 0);
    $response->assertJsonPath('longestStudyDaySeconds', 0);
    $response->assertJsonPath('longestStudyDayDate', null);

    Date::setTestNow();
});
