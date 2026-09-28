<?php

use App\Models\DiagnosticEvent;
use App\Services\Diagnostics\DiagnosticRecorder;
use Illuminate\Support\Facades\Http;

/**
 * @param  array<string, mixed>  $extraFakes
 */
function fakeCoursesBackendForDiagnostics(array $extraFakes = []): void
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
            'data' => [
                'username' => 's1234567',
                'realname' => '測試學生',
                'picture' => '',
            ],
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
            'data' => ['path' => ['item' => []]],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=get-board-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['list' => []],
        ]),
        '*' => Http::response('<html><body></body></html>'),
    ]);
}

function loginForDiagnostics(string $path)
{
    return visit('/login')
        ->fill('input[autocomplete="username"]', 's1234567')
        ->fill('input[autocomplete="current-password"]', 'secret')
        ->click('登入')
        ->assertPathIs('/courses')
        ->navigate($path);
}

it('shows the failure code without the detail panel being expanded', function () {
    // The school portal page behind 學習時數 fails, which GetCourseLearningTimeItems
    // turns into a 502 — so the blame belongs upstream, not to us.
    fakeCoursesBackendForDiagnostics([
        'https://uu.nou.edu.tw/learn/last10.php*' => Http::response('boom', 500),
    ]);

    loginForDiagnostics('/courses/9001')
        ->assertSee('讀取學習時數失敗。')
        // Visible while collapsed: a screenshot alone says which stream broke
        // (CLT = 學習時數) and that the upstream answered 502.
        ->assertSee('[CLT-U502]')
        ->assertDontSee('學校系統')
        ->click('詳細資料')
        ->assertSee('學校系統回應錯誤')
        ->assertSee('識別碼')
        ->assertNoJavaScriptErrors();
});

it('lists the failed request in the diagnostic log', function () {
    enableDiagnosticRecording();

    fakeCoursesBackendForDiagnostics([
        'https://uu.nou.edu.tw/learn/last10.php*' => Http::response('boom', 500),
    ]);

    loginForDiagnostics('/courses/9001')
        ->assertSee('[CLT-U502]')
        ->navigate('/settings/diagnostics/log')
        ->assertSee('診斷記錄')
        ->assertSee('learning-times')
        ->assertNoJavaScriptErrors();

    // Both halves of the same failure were recorded: our own endpoint
    // returning 502, and the upstream page that caused it.
    expect(DiagnosticEvent::where('status', 502)->exists())->toBeTrue()
        ->and(DiagnosticEvent::where('status', 500)->exists())->toBeTrue();
});

it('reaches the diagnostic log without a live session', function () {
    visit('/settings/diagnostics/log')
        ->assertSee('診斷記錄')
        ->assertNoJavaScriptErrors();
});

it('records nothing until the user opens a window, then explains why', function () {
    fakeCoursesBackendForDiagnostics([
        'https://uu.nou.edu.tw/learn/last10.php*' => Http::response('boom', 500),
    ]);

    // Recording is off by default, so a failure leaves the log empty and the
    // page has to say so rather than looking broken.
    loginForDiagnostics('/courses/9001')
        ->assertSee('[CLT-U502]')
        ->navigate('/settings/diagnostics/log')
        ->assertSee('診斷記錄未開啟')
        ->assertSee('請先於上方開啟診斷記錄')
        ->assertNoJavaScriptErrors();

    expect(DiagnosticEvent::count())->toBe(0);
});

it('starts recording from the log page and reports the window', function () {
    visit('/settings/diagnostics/log')
        ->assertSee('診斷記錄未開啟')
        ->click('切換診斷記錄')
        ->assertSee('記錄中')
        ->assertSee('分鐘後自動關閉')
        ->assertNoJavaScriptErrors();

    expect(app(DiagnosticRecorder::class)->recordingExpiresAt())
        ->not->toBeNull();
});

it('offers the recording toggle in settings, off by default', function () {
    visit('/settings')
        ->assertSee('紀錄診斷紀錄以協助瞭解問題')
        ->assertSee('30')
        ->assertDontSee('記錄中，約')
        ->click('切換診斷記錄')
        ->assertSee('記錄中，約')
        ->assertNoJavaScriptErrors();

    expect(app(DiagnosticRecorder::class)->recordingExpiresAt())
        ->not->toBeNull();
});
