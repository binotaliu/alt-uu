<?php

use Illuminate\Support\Facades\Http;

it('shows thread posts and whispers, and submits a new reply', function () {
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
        'https://uu.nou.edu.tw/xmlapi/index.php?action=get-board-reply-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'list' => [
                    ['floor' => 1, 'node' => 'P-1', 'realname' => '測試', 'content' => 'Hello world', 'post_date' => '2024-01-01', 'push' => 0, 'whispercnt' => 1],
                ],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=board-whisper-handler*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'list' => [
                    ['wid' => 'W-1', 'realname' => '小明', 'content' => '這是留言', 'create_time_description' => '1 分鐘前'],
                ],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=set-forum-read*' => Http::response([
            'code' => 0,
            'message' => 'ok',
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=add-course-post*' => Http::response([
            'code' => 0,
            'message' => 'ok',
            'data' => ['post_id' => 'P-2'],
        ]),
    ]);

    visit('/login')
        ->fill('input[autocomplete="username"]', 's1234567')
        ->fill('input[autocomplete="current-password"]', 'secret')
        ->click('登入')
        ->assertPathIs('/courses')
        ->navigate('/courses/1001/discuss/1001/B-1/N-1')
        ->assertSee('Hello world')
        ->assertSee('這是留言')
        ->click('新增回覆')
        ->fill('textarea[placeholder="內容"]', 'A brand new reply')
        ->click('送出回覆')
        // The compose modal is removed from the DOM once the submission succeeds.
        ->assertMissing('[role="dialog"]');

    Http::assertSent(function ($request) {
        if (! str_contains($request->url(), 'action=add-course-post')) {
            return false;
        }

        $body = json_decode($request->body(), true);

        return ($body['content'] ?? null) === 'A brand new reply';
    });
});

it('renders image attachments inline and enlarges them on tap, leaving other files as download links', function () {
    $onePixelPng = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');

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
        'https://uu.nou.edu.tw/xmlapi/index.php?action=get-board-reply-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'list' => [
                    [
                        'floor' => 1,
                        'node' => 'P-1',
                        'realname' => '測試',
                        'content' => 'Hello world',
                        'post_date' => '2024-01-01',
                        'push' => 0,
                        'whispercnt' => 0,
                        'attachment' => [
                            ['filename' => 'photo.png', 'href' => 'https://uu.nou.edu.tw/uploads/photo.png'],
                            ['filename' => 'notes.pdf', 'href' => 'https://uu.nou.edu.tw/uploads/notes.pdf'],
                        ],
                    ],
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
        'https://uu.nou.edu.tw/uploads/photo.png' => Http::response($onePixelPng, 200, [
            'Content-Type' => 'image/png',
        ]),
        '*' => Http::response('<html><body></body></html>'),
    ]);

    visit('/login')
        ->fill('input[autocomplete="username"]', 's1234567')
        ->fill('input[autocomplete="current-password"]', 'secret')
        ->click('登入')
        ->assertPathIs('/courses')
        ->navigate('/courses/1001/discuss/1001/B-1/N-1')
        ->assertSee('Hello world')
        // The image attachment renders as an inline thumbnail, not just a link.
        ->assertPresent('img[alt="photo.png"]')
        // The non-image attachment keeps the download-link behaviour.
        ->assertSee('notes.pdf')
        ->assertMissing('img[alt="notes.pdf"]')
        ->click('img[alt="photo.png"]')
        ->assertPresent('[role="dialog"] img[alt="photo.png"]')
        ->click('[aria-label="關閉"]')
        ->assertMissing('[role="dialog"] img[alt="photo.png"]');
});
