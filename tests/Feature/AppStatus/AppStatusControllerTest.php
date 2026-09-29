<?php

use App\Models\KeyValueStore;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Facades\System;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

const STATUS_URL = 'https://statics.test/status.json';

beforeEach(function () {
    KeyValueStore::query()->truncate();
    Cache::flush();
    config([
        'services.statics.base_url' => 'https://statics.test',
        'nativephp.version' => '1.0.0',
    ]);
    Http::preventStrayRequests();
});

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function statusFeed(array $overrides = []): array
{
    return array_merge([
        'latest' => ['ios' => '1.0.0', 'android' => '1.0.0'],
        'minSupported' => ['ios' => '1.0.0', 'android' => '1.0.0'],
        'storeUrl' => ['ios' => 'https://apps.apple.com/app/alt-uu', 'android' => 'https://play.google.com/store/apps/details?id=alt.uu'],
        'announcements' => [],
    ], $overrides);
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function announcement(array $overrides = []): array
{
    return array_merge([
        'id' => 'video-stall',
        'severity' => 'warning',
        'title' => '部分影片無法播放',
        'body' => '我們正在處理中',
    ], $overrides);
}

/**
 * Swaps in a fresh client each time: stubs registered on the same one stack
 * up and the first match wins, so re-faking would silently keep the old reply.
 */
function fakeStatusFeedResponse(mixed $body, int $status = 200): void
{
    Http::swap(new Factory);
    Http::preventStrayRequests();
    Http::fake([STATUS_URL => Http::response($body, $status)]);
}

/**
 * @param  array<string, mixed>  $feed
 */
function fakeStatusFeed(array $feed): void
{
    fakeStatusFeedResponse($feed);
}

it('returns nothing when the feed has nothing to show', function () {
    fakeStatusFeed(statusFeed());

    getJson('/api/app-status')
        ->assertOk()
        ->assertExactJson(['update' => null, 'announcements' => []]);
});

it('returns nothing when the feed is unreachable', function () {
    fakeStatusFeedResponse('boom', 500);

    getJson('/api/app-status')
        ->assertOk()
        ->assertExactJson(['update' => null, 'announcements' => []]);
});

it('offers an update when a newer version is out', function () {
    fakeStatusFeed(statusFeed(['latest' => ['ios' => '1.2.0', 'android' => '1.2.0']]));

    getJson('/api/app-status')
        ->assertOk()
        ->assertJsonPath('update', [
            'dismissKey' => 'update:1.2.0',
            'latestVersion' => '1.2.0',
            'storeUrl' => 'https://apps.apple.com/app/alt-uu',
            'required' => false,
        ]);
});

it('uses the android entries on android', function () {
    System::shouldReceive('isAndroid')->andReturn(true);
    fakeStatusFeed(statusFeed(['latest' => ['ios' => '1.0.0', 'android' => '1.3.0']]));

    getJson('/api/app-status')
        ->assertJsonPath('update.latestVersion', '1.3.0')
        ->assertJsonPath('update.storeUrl', 'https://play.google.com/store/apps/details?id=alt.uu');
});

it('does not offer an update when already on the latest version or newer', function (string $current) {
    config(['nativephp.version' => $current]);
    fakeStatusFeed(statusFeed(['latest' => ['ios' => '1.2.0', 'android' => '1.2.0']]));

    getJson('/api/app-status')->assertJsonPath('update', null);
})->with(['1.2.0', '1.3.0']);

it('never offers an update to builds without a release number', function () {
    config(['nativephp.version' => 'DEBUG']);
    fakeStatusFeed(statusFeed(['latest' => ['ios' => '9.0.0', 'android' => '9.0.0']]));

    getJson('/api/app-status')->assertJsonPath('update', null);
});

it('drops a store url that is not https', function () {
    fakeStatusFeed(statusFeed([
        'latest' => ['ios' => '1.2.0'],
        'storeUrl' => ['ios' => 'javascript:alert(1)'],
    ]));

    getJson('/api/app-status')->assertJsonPath('update.storeUrl', null);
});

it('marks an update required below the minimum supported version', function () {
    fakeStatusFeed(statusFeed([
        'latest' => ['ios' => '1.2.0'],
        'minSupported' => ['ios' => '1.1.0'],
    ]));

    getJson('/api/app-status')->assertJsonPath('update.required', true);
});

it('remembers a dismissed update only until the next release', function () {
    fakeStatusFeed(statusFeed(['latest' => ['ios' => '1.2.0']]));

    postJson('/api/app-status/dismissals', ['dismissKey' => 'update:1.2.0'])
        ->assertCreated()
        ->assertJsonPath('update', null);

    getJson('/api/app-status')->assertJsonPath('update', null);

    Cache::flush();
    fakeStatusFeed(statusFeed(['latest' => ['ios' => '1.3.0']]));

    getJson('/api/app-status')->assertJsonPath('update.latestVersion', '1.3.0');
});

it('keeps showing a required update after it was dismissed', function () {
    fakeStatusFeed(statusFeed([
        'latest' => ['ios' => '1.2.0'],
        'minSupported' => ['ios' => '1.2.0'],
    ]));

    postJson('/api/app-status/dismissals', ['dismissKey' => 'update:1.2.0'])
        ->assertJsonPath('update.required', true);
});

it('lists announcements with sensible defaults', function () {
    fakeStatusFeed(statusFeed([
        'announcements' => [
            announcement(['url' => 'https://alt-uu-statics.pages.dev/changelog.html#video']),
            announcement(['id' => 'plain', 'severity' => 'bogus', 'body' => null, 'title' => '簡單公告']),
        ],
    ]));

    getJson('/api/app-status')
        ->assertOk()
        ->assertJsonCount(2, 'announcements')
        ->assertJsonPath('announcements.0', [
            'dismissKey' => 'announcement:video-stall',
            'severity' => 'warning',
            'title' => '部分影片無法播放',
            'body' => '我們正在處理中',
            'url' => 'https://alt-uu-statics.pages.dev/changelog.html#video',
            'dismissible' => true,
        ])
        ->assertJsonPath('announcements.1.severity', 'info')
        ->assertJsonPath('announcements.1.body', '')
        ->assertJsonPath('announcements.1.url', null);
});

it('skips malformed announcements without failing the rest', function () {
    fakeStatusFeed(statusFeed([
        'announcements' => [
            'not-an-object',
            announcement(['id' => '']),
            announcement(['title' => '']),
            announcement(['id' => 'good']),
        ],
    ]));

    getJson('/api/app-status')
        ->assertJsonCount(1, 'announcements')
        ->assertJsonPath('announcements.0.dismissKey', 'announcement:good');
});

it('filters announcements by platform', function () {
    fakeStatusFeed(statusFeed([
        'announcements' => [
            announcement(['id' => 'ios-only', 'platforms' => ['ios']]),
            announcement(['id' => 'android-only', 'platforms' => ['android']]),
            announcement(['id' => 'everyone', 'platforms' => []]),
        ],
    ]));

    getJson('/api/app-status')
        ->assertJsonCount(2, 'announcements')
        ->assertJsonPath('announcements.0.dismissKey', 'announcement:ios-only')
        ->assertJsonPath('announcements.1.dismissKey', 'announcement:everyone');
});

it('filters announcements by version range', function () {
    config(['nativephp.version' => '1.1.0']);
    fakeStatusFeed(statusFeed([
        'announcements' => [
            announcement(['id' => 'in-range', 'minVersion' => '1.0.0', 'maxVersion' => '1.1.0']),
            announcement(['id' => 'too-new-needed', 'minVersion' => '1.2.0']),
            announcement(['id' => 'fixed-already', 'maxVersion' => '1.0.2']),
        ],
    ]));

    getJson('/api/app-status')
        ->assertJsonCount(1, 'announcements')
        ->assertJsonPath('announcements.0.dismissKey', 'announcement:in-range');
});

it('hides expired announcements and those with an unreadable expiry', function () {
    Date::setTestNow('2026-10-01T00:00:00+08:00');
    fakeStatusFeed(statusFeed([
        'announcements' => [
            announcement(['id' => 'live', 'expires' => '2026-10-15T00:00:00+08:00']),
            announcement(['id' => 'expired', 'expires' => '2026-09-30T00:00:00+08:00']),
            announcement(['id' => 'typo', 'expires' => 'next tuesday-ish']),
            announcement(['id' => 'no-expiry']),
        ],
    ]));

    getJson('/api/app-status')
        ->assertJsonCount(2, 'announcements')
        ->assertJsonPath('announcements.0.dismissKey', 'announcement:live')
        ->assertJsonPath('announcements.1.dismissKey', 'announcement:no-expiry');
});

it('hides a dismissed announcement but not one marked non-dismissible', function () {
    fakeStatusFeed(statusFeed([
        'announcements' => [
            announcement(['id' => 'closable']),
            announcement(['id' => 'sticky', 'dismissible' => false]),
        ],
    ]));

    postJson('/api/app-status/dismissals', ['dismissKey' => 'announcement:closable'])->assertCreated();
    postJson('/api/app-status/dismissals', ['dismissKey' => 'announcement:sticky'])->assertCreated();

    getJson('/api/app-status')
        ->assertJsonCount(1, 'announcements')
        ->assertJsonPath('announcements.0.dismissKey', 'announcement:sticky')
        ->assertJsonPath('announcements.0.dismissible', false);
});

it('rejects dismissal keys of an unknown kind', function (string $key) {
    postJson('/api/app-status/dismissals', ['dismissKey' => $key])->assertUnprocessable();
})->with(['', 'whatever', 'update:', str_repeat('a', 200)]);

it('serves the feed from cache instead of refetching', function () {
    fakeStatusFeed(statusFeed());

    getJson('/api/app-status')->assertOk();
    getJson('/api/app-status')->assertOk();

    Http::assertSentCount(1);
});

it('falls back to the last good feed and backs off while the feed is down', function () {
    fakeStatusFeed(statusFeed(['announcements' => [announcement()]]));
    getJson('/api/app-status')->assertJsonCount(1, 'announcements');

    Cache::forget('app-status:feed');
    fakeStatusFeedResponse('down', 503);

    getJson('/api/app-status')->assertJsonCount(1, 'announcements');
    getJson('/api/app-status')->assertJsonCount(1, 'announcements');

    Http::assertSentCount(1);
});
