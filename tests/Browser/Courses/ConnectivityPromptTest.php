<?php

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

function fakeBoardWithUnreachableUpstream(): void
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
            'data' => ['username' => 's1234567', 'realname' => '測試學生', 'picture' => ''],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['list' => [['bid' => '1001', 'title' => '現代歷史課程']]],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=get-board-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'list' => [
                    ['board_id' => 'B-1', 'board_name' => '課程討論', 'subject_cnt' => 1, 'is_bulletin' => 0, 'read_flag' => 0],
                ],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=get-board-node-list*' => fn () => throw new ConnectionException('cURL error 28: timed out'),
    ]);
}

it('does not suggest diagnostics on the first failure', function () {
    fakeBoardWithUnreachableUpstream();

    visit('/login')
        ->fill('input[autocomplete="username"]', 's1234567')
        ->fill('input[autocomplete="current-password"]', 'secret')
        ->click('登入')
        ->assertPathIs('/courses')
        ->navigate('/courses/1001/discuss/1001/B-1')
        ->assertSee('重試')
        ->assertDontSee('連線似乎有問題');
});

it('suggests diagnostics only after repeated retries, then stays quiet', function () {
    fakeBoardWithUnreachableUpstream();

    visit('/login')
        ->fill('input[autocomplete="username"]', 's1234567')
        ->fill('input[autocomplete="current-password"]', 'secret')
        ->click('登入')
        ->assertPathIs('/courses')
        ->navigate('/courses/1001/discuss/1001/B-1')
        ->click('重試')
        ->assertDontSee('連線似乎有問題')
        ->click('重試')
        ->assertDontSee('連線似乎有問題')
        ->click('重試')
        ->assertSee('連線似乎有問題')
        ->click('稍後再說')
        ->assertDontSee('連線似乎有問題')
        ->click('重試')
        ->click('重試')
        ->click('重試')
        ->assertDontSee('連線似乎有問題')
        ->assertNoJavaScriptErrors();
});
