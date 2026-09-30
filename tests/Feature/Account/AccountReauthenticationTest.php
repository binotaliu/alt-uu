<?php

use App\Models\Account;
use App\Services\AccountActiveProfile;
use App\Services\AccountCredentialsStore;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

it('returns a session_invalid code and the failed account id when the active session and remembered login both fail', function () {
    app(AccountCredentialsStore::class)->put('s1234567', 'wrong-secret');
    $account = Account::query()->where('username', 's1234567')->firstOrFail();

    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 403,
            'message' => 'invalid account',
            'data' => [],
        ]),
    ]);

    $response = getJson('/api/courses');

    $response->assertUnauthorized();
    $response->assertJson([
        'code' => 'session_invalid',
        'accountId' => $account->id,
    ]);
});

it('keeps GET /api/accounts reachable even when the active session is invalid', function () {
    app(AccountCredentialsStore::class)->put('s1234567', 'wrong-secret');

    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 403,
            'message' => 'invalid account',
            'data' => [],
        ]),
    ]);

    $response = getJson('/api/accounts');

    $response->assertSuccessful();
});

it('can still switch to a different account after the active one dies, without getting locked out by its own gate', function () {
    app(AccountCredentialsStore::class)->put('s1111111', 'wrong-secret');
    $first = Account::query()->where('username', 's1111111')->firstOrFail();

    app(AccountCredentialsStore::class)->put('s2222222', 'secret-b');
    $second = Account::query()->where('username', 's2222222')->firstOrFail();
    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-b',
        'session_idx' => 'idx-b',
        'cookies' => ['WM' => 'cookie-b'],
        'profile' => [
            'display_name' => '測試學生 B',
            'username' => 's2222222',
            'picture' => '',
            'realname' => '測試學生 B',
        ],
    ], $second->id);
    app(AccountActiveProfile::class)->set($first->id);
    seedActiveSubscription();

    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 403,
            'message' => 'invalid account',
            'data' => [],
        ]),
    ]);

    // First's remembered login fails and soft-deletes it, but the active
    // profile pointer deliberately keeps pointing at it (so concurrent
    // requests can still report which account failed) — before this fix,
    // that left every /api/accounts/* route permanently 401ing since
    // EnsureHunguSession re-checked that (now dead) account's session on
    // every subsequent request.
    getJson('/api/courses')->assertUnauthorized();
    expect(app(AccountActiveProfile::class)->get())->toBe($first->id);

    $response = postJson("/api/accounts/{$second->id}/switch");

    $response->assertSuccessful();
    $response->assertJson(['ok' => true]);
    expect(app(AccountActiveProfile::class)->get())->toBe($second->id);
});

it('reauthenticates a soft-deleted account by password and restores it as active', function () {
    app(AccountCredentialsStore::class)->put('s1234567', 'old-secret');
    $account = Account::query()->where('username', 's1234567')->firstOrFail();

    Http::fake([
        'https://uu.nou.edu.tw/' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'PHPSESSID=home; path=/',
        ]),
        'https://uu.nou.edu.tw/learn/index.php' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'WMSESSID=learn; path=/',
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::sequence()
            // First call: the middleware's remembered-login attempt fails.
            ->push([
                'code' => 403,
                'message' => 'invalid account',
                'data' => [],
            ])
            // Second call: the reauthenticate endpoint succeeds.
            ->push([
                'code' => 0,
                'message' => 'success',
                'data' => [
                    'session_data' => ['ticket' => 'ticket-relogin'],
                    'idx_data' => ['session_idx' => 'idx-relogin'],
                    'login_data' => ['realname' => '測試學生'],
                    'cookie_data' => ['WM' => 'cookie-from-payload'],
                ],
            ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'username' => 's1234567',
                'realname' => '測試學生',
                'picture' => '',
            ],
        ]),
    ]);

    // Trigger the middleware's remembered-login failure, which soft-deletes
    // the account but leaves it as the (now dead) active profile.
    getJson('/api/courses')->assertUnauthorized();

    expect(Account::query()->find($account->id))->toBeNull();
    expect(app(AccountActiveProfile::class)->get())->toBe($account->id);

    $response = postJson("/api/accounts/{$account->id}/reauthenticate", [
        'password' => 'new-secret',
    ]);

    $response->assertSuccessful();
    $response->assertJson(['ok' => true]);

    $restored = Account::query()->find($account->id);
    expect($restored)->not->toBeNull()
        ->and($restored->id)->toBe($account->id)
        ->and(app(AccountActiveProfile::class)->get())->toBe($account->id)
        ->and(app(UUSessionStore::class)->get()['profile']['username'] ?? null)->toBe('s1234567');
});

it('rejects reauthentication with the wrong password and leaves the account untouched', function () {
    $account = Account::query()->create([
        'username' => 's7654321',
        'password' => null,
    ]);

    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 403,
            'message' => 'invalid account',
            'data' => [],
        ]),
    ]);

    $response = postJson("/api/accounts/{$account->id}/reauthenticate", [
        'password' => 'wrong-secret',
    ]);

    $response->assertStatus(422);
    expect(app(AccountActiveProfile::class)->get())->not->toBe($account->id);
});

it('scopes reauthentication to the requested account and never touches another account', function () {
    app(AccountCredentialsStore::class)->put('s1111111', 'secret-a');
    $first = Account::query()->where('username', 's1111111')->firstOrFail();

    app(AccountCredentialsStore::class)->put('s2222222', 'secret-b');
    $second = Account::query()->where('username', 's2222222')->firstOrFail();

    Http::fake([
        'https://uu.nou.edu.tw/' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'PHPSESSID=home; path=/',
        ]),
        'https://uu.nou.edu.tw/learn/index.php' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'WMSESSID=learn; path=/',
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'session_data' => ['ticket' => 'ticket-a'],
                'idx_data' => ['session_idx' => 'idx-a'],
                'login_data' => ['realname' => '測試學生 A'],
                'cookie_data' => ['WM' => 'cookie-a'],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'username' => 's1111111',
                'realname' => '測試學生 A',
                'picture' => '',
            ],
        ]),
    ]);

    $response = postJson("/api/accounts/{$first->id}/reauthenticate", [
        'password' => 'fresh-secret',
    ]);

    $response->assertSuccessful();
    expect(app(AccountActiveProfile::class)->get())->toBe($first->id)
        ->and($second->fresh())->not->toBeNull()
        ->and($second->fresh()->username)->toBe('s2222222');
});
