<?php

use Illuminate\Support\Facades\Http;

/**
 * @param  array<string, mixed>  $extraFakes
 */
function fakeBackendForMaterialSource(array $extraFakes = []): void
{
    Http::fake($extraFakes + [
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
            'data' => ['list' => [
                ['course_id' => '9001', 'title' => '(114上)測試課程甲-甲班'],
            ]],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-path-info*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['path' => ['item' => [
                [
                    'identifier' => 'A1',
                    'text' => '第一章',
                    'href' => 'about:blank',
                    'item' => [
                        [
                            'identifier' => 'A2',
                            'text' => '1-1 課程簡介',
                            'href' => 'https://uu.nou.edu.tw/material/lesson-1.html',
                            'leaf' => true,
                        ],
                        [
                            'identifier' => 'A3',
                            'text' => '1-2 空白頁',
                            'href' => 'https://uu.nou.edu.tw/material/blank.html',
                            'leaf' => true,
                        ],
                    ],
                ],
            ]]],
        ]),
        'https://uu.nou.edu.tw/material/lesson-1.html' => Http::response(
            '<html><body><h2>第一章內容</h2></body></html>',
            200,
            ['Content-Type' => 'text/html; charset=utf-8'],
        ),
        'https://uu.nou.edu.tw/material/blank.html' => Http::response(
            '<html><body></body></html>',
            200,
            ['Content-Type' => 'text/html; charset=utf-8'],
        ),
        '*' => Http::response('<html><body></body></html>'),
    ]);
}

function openMaterialSource()
{
    return visit('/login')
        ->fill('input[autocomplete="username"]', 's1234567')
        ->fill('input[autocomplete="current-password"]', 'secret')
        ->click('登入')
        ->assertPathIs('/courses')
        ->navigate('/settings/diagnostics/material');
}

it('lists the directory nodes with their urls for a chosen course', function () {
    fakeBackendForMaterialSource();

    openMaterialSource()
        ->assertSee('教材來源檢視')
        ->select('#material-source-course', '9001')
        ->assertSee('教材目錄（3 個節點）')
        ->assertSee('1-1 課程簡介')
        ->assertSee('https://uu.nou.edu.tw/material/lesson-1.html')
        // A placeholder link is shown as the school sent it, not offered for inspection.
        ->assertSee('about:blank')
        ->assertNoJavaScriptErrors();
});

it('shows a node\'s raw source next to how it was parsed', function () {
    fakeBackendForMaterialSource();

    openMaterialSource()
        ->select('#material-source-course', '9001')
        ->assertSee('1-1 課程簡介')
        ->click('檢視內容')
        ->assertSee('原始碼')
        ->assertSee('<h2>第一章內容</h2>')
        ->assertSee('解析出文字內容')
        ->assertSee('200')
        ->assertNoJavaScriptErrors();
});

it('explains an empty page instead of leaving the user with the empty-state message', function () {
    fakeBackendForMaterialSource();

    openMaterialSource()
        ->select('#material-source-course', '9001')
        ->assertSee('1-2 空白頁')
        ->click('li:has-text("1-2 空白頁") button')
        ->assertSee('解析後沒有可顯示的內容')
        ->assertNoJavaScriptErrors();
});
