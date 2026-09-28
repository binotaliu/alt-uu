<?php

use App\Models\KeyValueStore;
use Illuminate\Support\Facades\Http;

function loginToCoursesForAccountTests(): void
{
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
}

it('shows the profile and Alt UU+ upsell for a logged-in account', function () {
    loginToCoursesForAccountTests();

    visit('/courses/account')
        ->assertSee('我的帳號')
        ->assertSee('測試學生')
        ->assertSee('s1234567')
        ->assertSee('升級')
        ->assertSee('解鎖主題色、學習統計等更多功能');
});

it('navigates to the account switcher', function () {
    loginToCoursesForAccountTests();

    visit('/courses/account')
        ->assertSee('我的帳號')
        ->click('切換帳號')
        ->assertPathIs('/courses/account/accounts')
        ->assertSee('目前帳號');
});

it('keeps account switching available when Alt UU+ features are hidden', function () {
    loginToCoursesForAccountTests();

    KeyValueStore::query()->updateOrCreate(
        ['key' => 'preference:alt-uu-plus-disabled'],
        ['value' => json_encode(['disabled' => true], JSON_THROW_ON_ERROR)],
    );

    visit('/courses/account')
        ->assertSee('切換帳號')
        ->assertDontSee('升級');
});
