<?php

use Illuminate\Support\Facades\Http;

function fakeLoginEndpoints(): void
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
            'data' => [
                'list' => [
                    ['course_id' => '10050559', 'title' => '測試課程APP'],
                ],
            ],
        ]),
    ]);
}

function loginToApp(): void
{
    visit('/login')
        ->fill('input[autocomplete="username"]', 's1234567')
        ->fill('input[autocomplete="current-password"]', 'secret')
        ->click('登入')
        ->assertPathIs('/courses');
}

it('loads a course material and shows its content', function () {
    fakeLoginEndpoints();

    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-path-info*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'course_id' => '10050559',
                'base_url' => 'https://uu.nou.edu.tw',
                'path' => [
                    'text' => '課程內容',
                    'item' => [
                        [
                            'identifier' => 'node1',
                            'href' => 'https://uu.nou.edu.tw/learn/content1.html',
                            'text' => '第一課：導論',
                            'leaf' => true,
                            'itemDisabled' => false,
                        ],
                    ],
                ],
            ],
        ]),
        'https://uu.nou.edu.tw/learn/content1.html' => Http::response(
            '<html><body><div id="wrapper"><h2>教材內文測試</h2></div></body></html>',
            200,
            ['content-type' => 'text/html; charset=utf-8'],
        ),
        '*' => Http::response('<html><body></body></html>'),
    ]);

    loginToApp();

    visit('/courses/10050559/node1')
        ->assertSee('第一課：導論')
        ->assertSee('教材內文測試')
        ->assertNoJavaScriptErrors();
});
