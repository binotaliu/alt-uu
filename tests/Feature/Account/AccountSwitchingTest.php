<?php

use AltUU\Domains\Course\Actions\GetCoursePathInfo;
use App\Models\Account;
use App\Models\KeyValueStore;
use App\Models\PlaybackProgress;
use App\Services\AccountActiveProfile;
use App\Services\AccountCredentialsStore;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\patchJson;
use function Pest\Laravel\postJson;

function seedAccountSession(string $username, string $suffix): Account
{
    app(AccountCredentialsStore::class)->put($username, 'test-password');

    /** @var Account $account */
    $account = Account::query()->where('username', $username)->firstOrFail();

    app(UUSessionStore::class)->put([
        'base_url' => "https://uu-{$suffix}.nou.edu.tw",
        'ua' => 'test-agent',
        'ticket' => "ticket-{$suffix}",
        'session_idx' => "idx-{$suffix}",
        'cookies' => ['WM' => "cookie-{$suffix}"],
        'profile' => [
            'display_name' => "測試學生 {$suffix}",
            'username' => $username,
            'picture' => '',
            'realname' => "測試學生 {$suffix}",
        ],
    ], $account->id);

    return $account;
}

function seedActiveSubscription(): void
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

it('does not require a subscription to add a second account', function () {
    Http::fake();
    seedAccountSession('s1111111', 'a');

    $response = postJson('/api/accounts', [
        'username' => 's2222222',
        'password' => 'secret',
    ]);

    expect($response->status())->not->toBe(402);
});

it('rejects adding a 6th account', function () {
    seedAccountSession('s1000001', 'a');

    for ($i = 2; $i <= 4; $i++) {
        app(AccountCredentialsStore::class)->put("s100000{$i}", 'secret');
    }

    seedAccountSession('s1000005', 'e');

    expect(Account::query()->count())->toBe(5);

    $response = postJson('/api/accounts', [
        'username' => 's1000006',
        'password' => 'secret',
    ]);

    $response->assertStatus(422);
    expect(Account::query()->count())->toBe(5);
});

it('switches the active account and refreshes the session profile without a subscription', function () {
    $first = seedAccountSession('s5555555', 'a');
    $second = seedAccountSession('s6666666', 'b');
    app(AccountActiveProfile::class)->set($first->id);

    $response = postJson("/api/accounts/{$second->id}/switch");

    $response->assertSuccessful();
    $response->assertJson(['ok' => true]);
    $response->assertSessionHas('hungu.profile.username', 's6666666');

    expect(app(AccountActiveProfile::class)->get())->toBe($second->id)
        ->and(app(UUSessionStore::class)->get()['profile']['username'] ?? null)->toBe('s6666666');
});

it('leaves the active profile untouched when removing a non-active account', function () {
    $first = seedAccountSession('s7777777', 'a');
    $second = seedAccountSession('s8888888', 'b');
    app(AccountActiveProfile::class)->set($first->id);

    $response = deleteJson("/api/accounts/{$second->id}");

    $response->assertSuccessful();
    expect(app(AccountActiveProfile::class)->get())->toBe($first->id)
        ->and(Account::query()->find($second->id))->toBeNull();
});

it('auto-activates another saved account when the active account is removed', function () {
    $first = seedAccountSession('s9999991', 'a');
    $second = seedAccountSession('s9999992', 'b');
    app(AccountActiveProfile::class)->set($first->id);

    $response = deleteJson("/api/accounts/{$first->id}");

    $response->assertSuccessful();
    expect(app(AccountActiveProfile::class)->get())->toBe($second->id)
        ->and(app(UUSessionStore::class)->get()['profile']['username'] ?? null)->toBe('s9999992');
});

it('clears the active profile and session when the last account is removed', function () {
    $first = seedAccountSession('s9999993', 'a');
    app(AccountActiveProfile::class)->set($first->id);

    $response = deleteJson("/api/accounts/{$first->id}");

    $response->assertSuccessful();
    expect(app(AccountActiveProfile::class)->get())->toBeNull()
        ->and(app(UUSessionStore::class)->get())->toBeNull();
});

it('soft-deletes a removed account and clears its sensitive columns', function () {
    $account = seedAccountSession('s1122334', 'a');

    $response = deleteJson("/api/accounts/{$account->id}");

    $response->assertSuccessful();

    expect(Account::query()->find($account->id))->toBeNull();

    $trashed = Account::withTrashed()->find($account->id);

    expect($trashed)->not->toBeNull()
        ->and($trashed->trashed())->toBeTrue()
        ->and($trashed->password)->toBeNull()
        ->and($trashed->hungu_session)->toBeNull()
        ->and($trashed->school_portal_session)->toBeNull();
});

it('restores a soft-deleted account and keeps playback progress linked when the username is re-added', function () {
    $account = seedAccountSession('s5544332', 'a');

    PlaybackProgress::create([
        'account_id' => $account->id,
        'cid' => '1001',
        'activity_id' => 'N-1',
        'duration_seconds' => 120,
        'position_seconds' => 42.5,
        'hungu_upload_success' => true,
    ]);

    deleteJson("/api/accounts/{$account->id}")->assertSuccessful();

    app(AccountCredentialsStore::class)->put('s5544332', 'new-secret');

    $restored = Account::query()->where('username', 's5544332')->firstOrFail();

    expect($restored->id)->toBe($account->id)
        ->and(Account::query()->find($account->id))->not->toBeNull()
        ->and(PlaybackProgress::query()->where('account_id', $account->id)->count())->toBe(1);
});

it('sets a nickname for an account and reflects it in the account list', function () {
    $account = seedAccountSession('s6001001', 'a');

    $response = patchJson("/api/accounts/{$account->id}/nickname", [
        'nickname' => '我的主帳號',
    ]);

    $response->assertSuccessful();
    expect($account->fresh()->nickname)->toBe('我的主帳號');

    $listResponse = getJson('/api/accounts');
    $listResponse->assertSuccessful();
    expect(collect($listResponse->json())->firstWhere('id', $account->id)['nickname'])
        ->toBe('我的主帳號');
});

it('trims whitespace and clears the nickname when an empty value is submitted', function () {
    $account = seedAccountSession('s6001002', 'a');
    $account->update(['nickname' => '舊名稱']);

    $response = patchJson("/api/accounts/{$account->id}/nickname", [
        'nickname' => '   ',
    ]);

    $response->assertSuccessful();
    expect($account->fresh()->nickname)->toBeNull();
});

it('rejects a nickname that exceeds the maximum length', function () {
    $account = seedAccountSession('s6001003', 'a');

    $response = patchJson("/api/accounts/{$account->id}/nickname", [
        'nickname' => str_repeat('字', 31),
    ]);

    $response->assertStatus(422);
    expect($account->fresh()->nickname)->toBeNull();
});

it('shows the nickname of the active account in the session profile response', function () {
    $first = seedAccountSession('s6001004', 'a');
    $second = seedAccountSession('s6001005', 'b');
    app(AccountActiveProfile::class)->set($first->id);
    seedActiveSubscription();
    $second->update(['nickname' => '暱稱測試']);

    postJson("/api/accounts/{$second->id}/switch")->assertSuccessful();

    $response = getJson('/api/auth/profile');

    $response->assertSuccessful();
    $response->assertJson(['nickname' => '暱稱測試']);
});

it('keeps course-path-info cache isolated between accounts sharing the same course id', function () {
    $first = seedAccountSession('s2000001', 'a');
    $second = seedAccountSession('s2000002', 'b');

    Http::fake([
        'https://uu-a.nou.edu.tw/xmlapi/index.php?action=my-course-path-info*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['course_id' => '1001', 'path' => ['text' => 'A 的課程內容', 'item' => []]],
        ]),
        'https://uu-b.nou.edu.tw/xmlapi/index.php?action=my-course-path-info*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['course_id' => '1001', 'path' => ['text' => 'B 的課程內容', 'item' => []]],
        ]),
    ]);

    app(AccountActiveProfile::class)->set($first->id);
    $resultForFirst = app(GetCoursePathInfo::class)('1001');

    app(AccountActiveProfile::class)->set($second->id);
    $resultForSecond = app(GetCoursePathInfo::class)('1001');

    expect($resultForFirst['pathInfo']->pathText)->toBe('A 的課程內容')
        ->and($resultForSecond['pathInfo']->pathText)->toBe('B 的課程內容')
        ->and(Cache::has("alt-uu:courses:path-info:{$first->id}:1001"))->toBeTrue()
        ->and(Cache::has("alt-uu:courses:path-info:{$second->id}:1001"))->toBeTrue();
});
