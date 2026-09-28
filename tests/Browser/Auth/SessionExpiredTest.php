<?php

use App\Models\Account;
use App\Services\AccountActiveProfile;
use App\Services\AccountCredentialsStore;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;

/**
 * @param  array<string, mixed>  $extraFakes
 */
function fakeSessionExpiredBackend(array $extraFakes = []): void
{
    Http::fake($extraFakes + [
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['list' => []],
        ]),
        '*' => Http::response('<html><body></body></html>'),
    ]);
}

function seedValidAccountSession(string $username, string $suffix): Account
{
    app(AccountCredentialsStore::class)->put($username, 'test-password');

    /** @var Account $account */
    $account = Account::query()->where('username', $username)->firstOrFail();

    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu.nou.edu.tw',
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

it('offers an account picker when the active session dies and another profile is available', function () {
    fakeSessionExpiredBackend([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 403,
            'message' => 'invalid account',
            'data' => [],
        ]),
    ]);

    $first = seedValidAccountSession('s1111111', 'a');
    $second = seedValidAccountSession('s2222222', 'b');
    app(AccountActiveProfile::class)->set($first->id);

    // Drop just the cached session, forcing the next request's remembered-
    // login attempt, which the fake above makes fail.
    app(UUSessionStore::class)->forget($first->id);

    $page = visit('/courses');

    $page->assertSee('登入已失效')
        ->assertSee('s2222222')
        ->click('s2222222')
        ->assertDontSee('登入已失效')
        ->assertSee('已切換帳號');

    expect(app(AccountActiveProfile::class)->get())->toBe($second->id);
});

it('reloads the courses list for the account picked from the session-expired picker', function () {
    fakeSessionExpiredBackend([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 403,
            'message' => 'invalid account',
            'data' => [],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['list' => [
                ['course_id' => '2002', 'title' => '(114下)帳號二課程-B班'],
            ]],
        ]),
        // Needed so the account-switch boot-validation dance (which
        // revalidates the session against my-profile) succeeds for the
        // account being switched to, rather than falling through to the
        // catch-all HTML response and never clearing 409 boot_validation_required.
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'username' => 's2222222',
                'realname' => '測試學生 b',
                'picture' => '',
            ],
        ]),
    ]);

    $first = seedValidAccountSession('s1111111', 'a');
    $second = seedValidAccountSession('s2222222', 'b');
    app(AccountActiveProfile::class)->set($first->id);
    app(UUSessionStore::class)->forget($first->id);

    $page = visit('/courses');

    // The courses pane stays mounted behind the picker overlay (no route
    // change happens), so the fix must refetch it directly rather than
    // relying on onMounted/onActivated to fire again.
    $page->assertSee('登入已失效')
        ->click('s2222222')
        ->assertDontSee('登入已失效')
        ->assertSee('帳號二課程');

    expect(app(AccountActiveProfile::class)->get())->toBe($second->id);
});

it('sends the user to a re-login screen scoped to that account when no other profile exists', function () {
    fakeSessionExpiredBackend([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::sequence()
            // Remembered-login attempt made by the middleware: fails.
            ->push([
                'code' => 403,
                'message' => 'invalid account',
                'data' => [],
            ])
            // Explicit re-login submitted from the /reauth screen: succeeds.
            ->push([
                'code' => 0,
                'message' => 'success',
                'data' => [
                    'session_data' => ['ticket' => 'ticket-relogin'],
                    'idx_data' => ['session_idx' => 'idx-relogin'],
                    'login_data' => ['realname' => '測試學生'],
                    'cookie_data' => ['WM' => 'cookie-relogin'],
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

    $account = seedValidAccountSession('s1234567', 'a');
    app(AccountActiveProfile::class)->set($account->id);
    app(UUSessionStore::class)->forget($account->id);

    $page = visit('/courses');

    $page->assertPathIs("/reauth/{$account->id}")
        ->fill('input[autocomplete="current-password"]', 'new-secret')
        ->click('登入')
        ->assertPathIs('/courses');

    expect(app(AccountActiveProfile::class)->get())->toBe($account->id)
        ->and(app(UUSessionStore::class)->get()['profile']['username'] ?? null)->toBe('s1234567');
});

it('lets the user re-login to the failed account from the picker instead of switching profile', function () {
    fakeSessionExpiredBackend([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::sequence()
            // Remembered-login attempt made by the middleware: fails.
            ->push([
                'code' => 403,
                'message' => 'invalid account',
                'data' => [],
            ])
            // Explicit re-login submitted from the /reauth screen: succeeds.
            ->push([
                'code' => 0,
                'message' => 'success',
                'data' => [
                    'session_data' => ['ticket' => 'ticket-relogin'],
                    'idx_data' => ['session_idx' => 'idx-relogin'],
                    'login_data' => ['realname' => '測試學生'],
                    'cookie_data' => ['WM' => 'cookie-relogin'],
                ],
            ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'username' => 's1111111',
                'realname' => '測試學生',
                'picture' => '',
            ],
        ]),
    ]);

    $first = seedValidAccountSession('s1111111', 'a');
    seedValidAccountSession('s2222222', 'b');
    app(AccountActiveProfile::class)->set($first->id);
    app(UUSessionStore::class)->forget($first->id);

    $page = visit('/courses');

    // The failed account is soft-deleted, so it is missing from the account
    // list — the re-login option must still be offered for it.
    $page->assertSee('登入已失效')
        ->assertSee('重新登入「目前帳號」')
        ->click('重新登入「目前帳號」')
        ->assertPathIs("/reauth/{$first->id}")
        ->fill('input[autocomplete="current-password"]', 'new-secret')
        ->click('登入')
        ->assertPathIs('/courses');

    expect(app(AccountActiveProfile::class)->get())->toBe($first->id);
});
