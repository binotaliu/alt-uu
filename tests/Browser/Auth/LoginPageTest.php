<?php

use App\Models\KeyValueStore;
use Illuminate\Support\Facades\Http;

it('redirects to onboarding by default', function () {
    visit('/')->assertPathIs('/onboarding');
});

it('redirects to login once onboarding is completed but no accounts are remembered', function () {
    KeyValueStore::query()->updateOrCreate(
        ['key' => 'preference:onboarding-completed'],
        ['value' => json_encode(['completed' => true], JSON_THROW_ON_ERROR)],
    );

    visit('/')->assertPathIs('/login');
});

it('shows the login form', function () {
    visit('/login')
        ->assertSee('登入 NOU UU 平台')
        ->assertVisible('input[autocomplete="username"]')
        ->assertVisible('input[autocomplete="current-password"]');
});

it('logs in and redirects to courses', function () {
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
                'session_data' => ['ticket' => 'ticket-1'],
                'idx_data' => ['session_idx' => 'idx-1'],
                'login_data' => ['realname' => '測試學生'],
                'cookie_data' => ['WM' => 'cookie-from-payload'],
            ],
        ], 200, [
            'Set-Cookie' => 'APPCOOKIE=app; path=/',
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'username' => 's1234567',
                'realname' => '測試學生',
                'picture' => 'https://uu.nou.edu.tw/avatar.jpg',
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['list' => []],
        ]),
    ]);

    visit('/login')
        ->fill('input[autocomplete="username"]', 's1234567')
        ->fill('input[autocomplete="current-password"]', 'secret')
        ->click('登入')
        ->assertPathIs('/courses');
});

it('keeps the settings back button pointing at courses after a first-boot login', function () {
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
                'session_data' => ['ticket' => 'ticket-1'],
                'idx_data' => ['session_idx' => 'idx-1'],
                'login_data' => ['realname' => '測試學生'],
                'cookie_data' => ['WM' => 'cookie-from-payload'],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['username' => 's1234567', 'realname' => '測試學生', 'picture' => ''],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['list' => []],
        ]),
        '*' => Http::response('<html><body></body></html>'),
    ]);

    // No full page reload between login and settings: the SPA state left over
    // from the pre-login boot is exactly what used to send back to /login.
    visit('/login')
        ->fill('input[autocomplete="username"]', 's1234567')
        ->fill('input[autocomplete="current-password"]', 'secret')
        ->click('登入')
        ->assertPathIs('/courses')
        ->click('我的帳號')
        ->click('a[href="/settings"]')
        ->assertPathIs('/settings')
        ->click('button:has(svg path[d="M15 18l-6-6 6-6"])')
        ->assertPathIs('/courses');
});

it('keeps the user on the login page and flags the field on invalid credentials', function () {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 503,
            'message' => 'Auth fail',
            'data' => [],
        ]),
    ]);

    visit('/login')
        ->fill('input[autocomplete="username"]', 's1234567')
        ->fill('input[autocomplete="current-password"]', 'wrong-password')
        ->click('登入')
        ->assertPathIs('/login')
        ->assertAttributeContains('div:has(> input[autocomplete="username"])', 'class', 'border-rose-400')
        ->assertSee('登入失敗，請確認帳號密碼。')
        ->assertSee('若登入持續失敗，可展開檢視伺服器回應內容')
        ->assertDontSee('Auth fail')
        ->click('若登入持續失敗，可展開檢視伺服器回應內容')
        ->assertSee('Auth fail');
});
