<?php

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

it('lists discussion threads for a board', function () {
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
        'https://uu.nou.edu.tw/xmlapi/index.php?action=get-board-node-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'list' => [
                    ['node' => 'N-1', 'subject' => '測試主題', 'poster' => 's999', 'reply' => 2, 'read' => true],
                ],
            ],
        ]),
    ]);

    visit('/login')
        ->fill('input[autocomplete="username"]', 's1234567')
        ->fill('input[autocomplete="current-password"]', 'secret')
        ->click('登入')
        ->assertPathIs('/courses')
        ->navigate('/courses/1001/discuss/1001/B-1')
        ->assertSee('文章列表')
        ->assertSee('測試主題')
        ->assertSee('新增文章');
});

it('navigates from the board list into a thread', function () {
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
        'https://uu.nou.edu.tw/xmlapi/index.php?action=get-board-node-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'list' => [
                    ['node' => 'N-1', 'subject' => '測試主題', 'poster' => 's999', 'reply' => 2, 'read' => true],
                ],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=get-board-reply-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'list' => [
                    ['floor' => 1, 'node' => 'P-1', 'realname' => '測試', 'content' => 'Hello world', 'post_date' => '2024-01-01', 'push' => 0, 'whispercnt' => 0],
                ],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=board-whisper-handler*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['list' => []],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=set-forum-read*' => Http::response([
            'code' => 0,
            'message' => 'ok',
        ]),
    ]);

    visit('/login')
        ->fill('input[autocomplete="username"]', 's1234567')
        ->fill('input[autocomplete="current-password"]', 'secret')
        ->click('登入')
        ->assertPathIs('/courses')
        ->navigate('/courses/1001/discuss/1001/B-1')
        ->assertSee('測試主題')
        ->click('測試主題')
        ->assertPathIs('/courses/1001/discuss/1001/B-1/N-1')
        ->assertSee('Hello world');
});

it('shows the failure code when creating a post fails', function () {
    // UUProxyClient swallows an upstream non-2xx as an empty payload, so the
    // request has to die outright for the client to see a failure: that is
    // the path that hands the ApiError to ErrorRetry.
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
        'https://uu.nou.edu.tw/xmlapi/index.php?action=get-board-node-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'list' => [
                    ['node' => 'N-1', 'subject' => '測試主題', 'poster' => 's999', 'reply' => 2, 'read' => true],
                ],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=add-course-post*' => fn () => throw new ConnectionException('cURL error 28: timed out'),
    ]);

    visit('/login')
        ->fill('input[autocomplete="username"]', 's1234567')
        ->fill('input[autocomplete="current-password"]', 'secret')
        ->click('登入')
        ->assertPathIs('/courses')
        ->navigate('/courses/1001/discuss/1001/B-1')
        ->assertSee('測試主題')
        ->click('新增文章')
        ->fill('textarea[placeholder="內容"]', '測試內容')
        ->click('送出文章')
        // Reaching the detail toggle means the catch block completed: an
        // unimported asApiError() throws inside it and no error ever renders.
        ->assertSee('詳細資料')
        ->assertNoJavaScriptErrors();
});
