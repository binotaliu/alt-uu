<?php

use App\Models\KeyValueStore;
use Illuminate\Support\Facades\Http;

/**
 * Preference rows are stored as JSON documents, keyed like the real store.
 */
function seedWhatsNewPreference(string $key, array $value): void
{
    KeyValueStore::query()->updateOrCreate(
        ['key' => $key],
        ['value' => json_encode($value, JSON_THROW_ON_ERROR)],
    );
}

/**
 * Fakes the upstream login, then signs in through the real form so the SPA boots at /courses.
 */
function loginForWhatsNewTests()
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
    config(['nativephp.version' => '1.1.0']);
});

it('shows the release notes once to an upgrading user after login', function () {
    seedWhatsNewPreference('preference:onboarding-completed', ['completed' => true]);
    loginForWhatsNewTests()
        ->assertPathIs('/courses')
        ->assertSee('Alt UU 有新功能了')
        ->assertSee('v1.1.0')
        ->assertSee('支援多帳號登入')
        ->assertSee('個人化主題色')
        ->assertSee('Alt UU+')
        ->click('好')
        ->assertDontSee('Alt UU 有新功能了')
        ->assertPathIs('/courses');

    $record = KeyValueStore::query()->where('key', 'preference:whats-new-seen-version')->first();

    expect(json_decode($record->value, true, 512, JSON_THROW_ON_ERROR))->toBe(['version' => '1.1.0']);
});

it('does not interrupt a user who already saw this version', function () {
    seedWhatsNewPreference('preference:onboarding-completed', ['completed' => true]);
    seedWhatsNewPreference('preference:whats-new-seen-version', ['version' => '1.1.0']);
    loginForWhatsNewTests()->assertPathIs('/courses');
});

it('does not show release notes to a user who has not finished onboarding', function () {
    loginForWhatsNewTests()->assertPathIs('/courses');
});

it('does not show release notes for a version without any', function () {
    config(['nativephp.version' => '9.9.9']);
    seedWhatsNewPreference('preference:onboarding-completed', ['completed' => true]);
    loginForWhatsNewTests()->assertPathIs('/courses');
});

it('records the current version as seen when finishing onboarding', function () {
    visit('/onboarding')
        ->click('繼續')
        ->click('繼續')
        ->click('開始使用')
        ->assertPathIs('/login');

    $record = KeyValueStore::query()->where('key', 'preference:whats-new-seen-version')->first();

    expect(json_decode($record->value, true, 512, JSON_THROW_ON_ERROR))->toBe(['version' => '1.1.0']);
});

it('can be reopened from settings and dismissed', function () {
    seedWhatsNewPreference('preference:whats-new-seen-version', ['version' => '1.1.0']);

    visit('/settings')
        ->assertDontSee('Alt UU 有新功能了')
        ->click('檢視新功能')
        ->assertSee('支援多帳號登入')
        ->click('好')
        ->assertDontSee('支援多帳號登入')
        ->assertPathIs('/settings');
});
