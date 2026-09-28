<?php

use App\Models\Account;
use App\Models\AccountDailyActivity;
use App\Models\KeyValueStore;
use App\Models\PlaybackProgress;
use App\Services\AccountActiveProfile;
use App\Services\AccountCredentialsStore;
use App\Services\UUSessionStore;
use Illuminate\Testing\TestResponse;

use function Pest\Laravel\withCookie;

function createDataPortabilityAccount(string $username): Account
{
    app(AccountCredentialsStore::class)->put($username, 'test-password');

    /** @var Account $account */
    $account = Account::query()->where('username', $username)->firstOrFail();

    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu-data-export.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-data-export',
        'session_idx' => 'idx-data-export',
        'cookies' => ['WM' => 'cookie-data-export'],
        'profile' => [
            'display_name' => "測試學生 {$username}",
            'username' => $username,
            'picture' => '',
            'realname' => "測試學生 {$username}",
        ],
    ], $account->id);

    app(AccountActiveProfile::class)->set($account->id);

    return $account;
}

function activateDataPortabilitySubscription(): void
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

function withDataPortabilityBootCookie()
{
    return withCookie(config('hungu.app_boot_cookie_name'), '1');
}

function exportDataPortability(): TestResponse
{
    return withDataPortabilityBootCookie()->getJson('/api/data-export');
}

it('allows export without an active subscription', function () {
    createDataPortabilityAccount('s1111111');

    $response = exportDataPortability();

    $response->assertSuccessful();
});

it('exports accounts, playback progress, and daily activity keyed by username', function () {
    $account = createDataPortabilityAccount('s2222222');
    activateDataPortabilitySubscription();

    PlaybackProgress::create([
        'account_id' => $account->id,
        'cid' => '1001',
        'activity_id' => 'N-1',
        'duration_seconds' => 120,
        'position_seconds' => 42.5,
        'hungu_upload_success' => true,
    ]);

    AccountDailyActivity::factory()->create([
        'account_id' => $account->id,
        'activity_date' => '2026-07-10',
        'total_seconds' => 900,
    ]);

    $response = exportDataPortability();

    $response->assertSuccessful();
    $response->assertHeader('Content-Disposition');
    $response->assertJsonPath('accounts.s2222222', $account->id);
    $response->assertJsonPath('playbackProgress.0.username', 's2222222');
    $response->assertJsonPath('playbackProgress.0.cid', '1001');
    $response->assertJsonPath('accountDailyActivities.0.username', 's2222222');
    $response->assertJsonPath('accountDailyActivities.0.totalSeconds', 900);
});

it('rejects import without an active subscription', function () {
    createDataPortabilityAccount('s3333333');

    $response = withDataPortabilityBootCookie()->postJson('/api/data-export/import', [
        'accounts' => ['s3333333' => 1],
        'playbackProgress' => [],
        'accountDailyActivities' => [],
    ]);

    $response->assertStatus(402);
});

it('imports matched accounts and skips usernames with no local account', function () {
    $account = createDataPortabilityAccount('s4444444');
    activateDataPortabilitySubscription();

    $payload = [
        'accounts' => ['s4444444' => 999, 'unknown-user' => 111],
        'playbackProgress' => [
            [
                'username' => 's4444444',
                'cid' => '1002',
                'activityId' => 'N-2',
                'durationSeconds' => 300,
                'positionSeconds' => 10.5,
                'hunguUploadSuccess' => false,
            ],
            [
                'username' => 'unknown-user',
                'cid' => '9999',
                'activityId' => 'N-9',
                'durationSeconds' => 100,
                'positionSeconds' => 1.0,
                'hunguUploadSuccess' => null,
            ],
        ],
        'accountDailyActivities' => [
            [
                'username' => 's4444444',
                'activityDate' => '2026-07-09',
                'totalSeconds' => 600,
            ],
        ],
    ];

    $response = withDataPortabilityBootCookie()->postJson('/api/data-export/import', $payload);

    $response->assertSuccessful();
    $response->assertJsonPath('importedAccountsCount', 1);
    $response->assertJsonPath('skippedUsernames', ['unknown-user']);
    $response->assertJsonPath('importedPlaybackProgressCount', 1);
    $response->assertJsonPath('importedAccountDailyActivitiesCount', 1);

    expect(PlaybackProgress::query()->where('account_id', $account->id)->where('cid', '1002')->count())->toBe(1)
        ->and(PlaybackProgress::query()->where('cid', '9999')->count())->toBe(0)
        ->and(AccountDailyActivity::query()->where('account_id', $account->id)->where('activity_date', '2026-07-09')->value('total_seconds'))->toBe(600);
});

it('does not duplicate rows when the same data is imported twice', function () {
    $account = createDataPortabilityAccount('s5555555');
    activateDataPortabilitySubscription();

    $payload = [
        'accounts' => ['s5555555' => 1],
        'playbackProgress' => [
            [
                'username' => 's5555555',
                'cid' => '1003',
                'activityId' => 'N-3',
                'durationSeconds' => 50,
                'positionSeconds' => 5.0,
                'hunguUploadSuccess' => true,
            ],
        ],
        'accountDailyActivities' => [
            [
                'username' => 's5555555',
                'activityDate' => '2026-07-08',
                'totalSeconds' => 200,
            ],
        ],
    ];

    withDataPortabilityBootCookie()->postJson('/api/data-export/import', $payload)->assertSuccessful();
    withDataPortabilityBootCookie()->postJson('/api/data-export/import', $payload)->assertSuccessful();

    expect(PlaybackProgress::query()->where('account_id', $account->id)->where('cid', '1003')->count())->toBe(1)
        ->and(AccountDailyActivity::query()->where('account_id', $account->id)->where('activity_date', '2026-07-08')->count())->toBe(1);
});
