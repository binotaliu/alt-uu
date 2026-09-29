<?php

use App\Models\KeyValueStore;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Signs in through the real form with status.json faked, so the SPA boots at /courses.
 *
 * @param  array<string, mixed>  $feed
 */
function loginForAppStatusTests(array $feed)
{
    Http::fake([
        'https://statics.test/status.json' => Http::response($feed),
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
            'data' => ['list' => []],
        ]),
        '*' => Http::response('<html><body></body></html>'),
    ]);

    return visit('/login')
        ->fill('input[autocomplete="username"]', 's1234567')
        ->fill('input[autocomplete="current-password"]', 'secret')
        ->click('登入');
}

beforeEach(function () {
    KeyValueStore::query()->truncate();
    Cache::flush();
    config([
        'nativephp.version' => '1.0.0',
        'services.statics.base_url' => 'https://statics.test',
    ]);
    KeyValueStore::query()->create([
        'key' => 'preference:onboarding-completed',
        'value' => json_encode(['completed' => true], JSON_THROW_ON_ERROR),
    ]);
    KeyValueStore::query()->create([
        'key' => 'preference:whats-new-seen-version',
        'value' => json_encode(['version' => '1.0.0'], JSON_THROW_ON_ERROR),
    ]);
});

it('shows the update banner and announcements on the courses screen and remembers dismissals', function () {
    loginForAppStatusTests([
        'latest' => ['ios' => '1.2.0', 'android' => '1.2.0'],
        'minSupported' => ['ios' => '1.0.0', 'android' => '1.0.0'],
        'storeUrl' => ['ios' => 'https://apps.apple.com/app/alt-uu', 'android' => 'https://play.google.com/store/apps/details?id=alt.uu'],
        'announcements' => [[
            'id' => 'video-stall',
            'severity' => 'warning',
            'title' => '部分影片無法播放',
            'body' => '我們正在處理中',
            'url' => 'https://statics.test/changelog.html',
        ]],
    ])
        ->assertPathIs('/courses')
        ->assertSee('有新版本可用')
        ->assertSee('Alt UU 1.2.0 已推出。')
        ->assertSee('前往更新')
        ->assertSee('部分影片無法播放')
        ->assertSee('我們正在處理中')
        ->assertSee('了解更多')
        ->click('[role="status"]:has-text("有新版本可用") button[aria-label="關閉"]')
        ->assertDontSee('有新版本可用')
        ->assertSee('部分影片無法播放')
        ->click('[role="status"]:has-text("部分影片無法播放") button[aria-label="關閉"]')
        ->assertDontSee('部分影片無法播放');

    $record = KeyValueStore::query()->where('key', 'app-status:dismissed')->first();

    expect(json_decode($record->value, true, 512, JSON_THROW_ON_ERROR))
        ->toBe(['keys' => ['update:1.2.0', 'announcement:video-stall']]);
});

it('shows nothing when there is no update and no announcement', function () {
    loginForAppStatusTests([
        'latest' => ['ios' => '1.0.0', 'android' => '1.0.0'],
        'announcements' => [],
    ])
        ->assertPathIs('/courses')
        ->assertDontSee('有新版本可用')
        ->assertDontSee('了解更多');
});
