<?php

use Illuminate\Support\Facades\Http;

function loginToCoursesForAccountsSwitcherTests(): void
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

it('shows the current account and offers adding another without a subscription', function () {
    loginToCoursesForAccountsSwitcherTests();

    visit('/courses/account/accounts')
        ->assertSee('切換帳號')
        ->assertSee('目前帳號')
        ->assertSee('s1234567')
        ->assertSee('新增帳號')
        ->assertDontSee('訂閱 Alt UU+');
});

it('removes the only account and redirects to login', function () {
    loginToCoursesForAccountsSwitcherTests();

    visit('/courses/account/accounts')
        ->assertSee('目前帳號')
        ->click('目前帳號')
        ->assertSee('登出此帳號')
        ->click('登出此帳號')
        ->assertSee('確定要移除這個帳號嗎')
        ->click('移除')
        ->assertPathIs('/login');
});
