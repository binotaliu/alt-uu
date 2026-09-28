<?php

use AltUU\AltUUPlus\Facades\AltUUPlus;
use Illuminate\Support\Facades\Http;

function loginToCoursesForSubscriptionTests(): void
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

it('lists available Alt UU+ products for an unsubscribed account', function () {
    loginToCoursesForSubscriptionTests();

    AltUUPlus::shouldReceive('fetchProducts')
        ->once()
        ->andReturn([
            (object) [
                'id' => 'alt_uu_premium_monthly',
                'displayName' => 'Alt UU Premium',
                'description' => '跨裝置同步學習進度',
                'displayPrice' => 'NT$90',
                'price' => 90.0,
            ],
        ]);

    visit('/courses/account/subscription')
        ->assertSee('升級 Alt UU+')
        ->assertSee('跨裝置同步學習進度')
        ->assertSee('Alt UU Premium')
        ->assertSee('NT$90')
        ->assertSee('已購買過？還原購買');
});
