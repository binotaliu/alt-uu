<?php

declare(strict_types=1);

use AltUU\Domains\AppPreference\Actions\GetAppPreferences;
use App\NativeComponents\Support\ReleaseNotes;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\Feature\Native\Fixtures\RecordingHost;

/**
 * @param  array<string, mixed>  $feed
 */
function fakeBannerFeed(array $feed): void
{
    Cache::flush();
    config(['services.statics.base_url' => 'https://statics.test', 'nativephp.version' => '1.0.0']);
    Http::swap(new Factory);
    Http::preventStrayRequests();
    Http::fake(['https://statics.test/status.json' => Http::response($feed)]);
}

/**
 * @return array<string, mixed>
 */
function bannerFeed(string $latest = '1.0.0', string $minSupported = '1.0.0'): array
{
    return [
        'latest' => ['ios' => $latest, 'android' => $latest],
        'minSupported' => ['ios' => $minSupported, 'android' => $minSupported],
        'storeUrl' => ['ios' => 'https://apps.apple.com/app/alt-uu', 'android' => 'https://play.google.com/store/apps/details?id=alt.uu'],
        'announcements' => [
            ['id' => 'video-stall', 'severity' => 'warning', 'title' => '部分影片無法播放', 'body' => '我們正在處理中', 'url' => 'https://example.com/more'],
        ],
    ];
}

it('renders nothing when the feed has no update or announcements', function (): void {
    fakeBannerFeed([...bannerFeed(), 'announcements' => []]);

    RecordingHost::mountView('app-status-banners')
        ->assertDontSee('有新版本可用')
        ->assertDontSee('了解更多');
});

it('shows a dismissible update banner and announcements with links', function (): void {
    fakeBannerFeed(bannerFeed('1.2.0'));

    RecordingHost::mountView('app-status-banners')
        ->assertSee('有新版本可用')
        ->assertSee('Alt UU 1.2.0 已推出。')
        ->assertSee('前往更新')
        ->assertSee('部分影片無法播放')
        ->assertSee('我們正在處理中')
        ->tap('open-store')
        ->assertNativeCalled('Browser.Open', fn (array $params): bool => str_contains($params['url'], 'apple.com'))
        ->tap('open-announcement:video-stall')
        ->assertNativeCalled('Browser.OpenInApp', fn (array $params): bool => $params['url'] === 'https://example.com/more');
});

it('hides a banner as soon as it is dismissed and remembers it', function (): void {
    fakeBannerFeed(bannerFeed('1.2.0'));

    RecordingHost::mountView('app-status-banners')
        ->tap('dismiss-update')
        ->assertDontSee('有新版本可用')
        ->tap('dismiss-announcement:video-stall')
        ->assertDontSee('部分影片無法播放');

    fakeBannerFeed(bannerFeed('1.2.0'));

    RecordingHost::mountView('app-status-banners')
        ->assertDontSee('有新版本可用')
        ->assertDontSee('部分影片無法播放');
});

it('does not offer a close button for a required update', function (): void {
    fakeBannerFeed(bannerFeed('1.2.0', '1.1.0'));

    RecordingHost::mountView('app-status-banners')
        ->assertSee('請更新至最新版本')
        ->assertSee('目前的版本已不再支援，請更新至 1.2.0。')
        ->assertMissingElement('pressable', fn (array $node): bool => ($node['ref'] ?? null) === 'dismiss-update');
});

it('shows nothing when the feed is unreachable', function (): void {
    Cache::flush();
    config(['services.statics.base_url' => 'https://statics.test']);
    Http::swap(new Factory);
    Http::fake(['*' => Http::response('nope', 500)]);

    RecordingHost::mountView('app-status-banners')->assertDontSee('了解更多');
});

it('ports the release notes and decides when to show them', function (): void {
    expect(ReleaseNotes::find('1.1.0')['highlights'])->toHaveCount(4)
        ->and(ReleaseNotes::find('9.9.9'))->toBeNull()
        ->and(ReleaseNotes::forVersionOrLatest('DEBUG')['version'])->toBe('1.1.0')
        ->and(ReleaseNotes::hasUnseen('1.1.0', ''))->toBeTrue()
        ->and(ReleaseNotes::hasUnseen('1.1.0', '1.1.0'))->toBeFalse()
        ->and(ReleaseNotes::hasUnseen('2.0.0', ''))->toBeFalse()
        ->and(ReleaseNotes::changelogUrl('1.1.0'))->toEndWith('/changelog?version=1.1.0');
});

it('shows the highlights, marks the version seen and opens the changelog', function (): void {
    config(['nativephp.version' => '1.1.0']);

    expect(ReleaseNotes::shouldShowNow())->toBeTrue();

    RecordingHost::mountView('whats-new-sheet', ['visible' => true])
        ->assertSee('v1.1.0')
        ->assertSee('Alt UU 有新功能了')
        ->assertSee('追蹤觀看進度')
        ->assertSee('個人化主題色')
        ->assertSee('Alt UU+')
        ->tap('changelog')
        ->assertNativeCalled('Browser.OpenInApp', fn (array $params): bool => str_ends_with($params['url'], '/changelog?version=1.1.0'));

    expect(app(GetAppPreferences::class)()->whatsNewSeenVersion)->toBe('1.1.0')
        ->and(ReleaseNotes::shouldShowNow())->toBeFalse();
});

it('emits close from the button and from a swipe-down', function (): void {
    config(['nativephp.version' => '1.1.0']);

    $host = RecordingHost::mountView('whats-new-sheet', ['visible' => true])->tap('close')->dismissSheet('whats-new');

    expect($host->get('events'))->toBe([['close'], ['close']]);
});

it('does not record a version without release notes', function (): void {
    config(['nativephp.version' => '9.9.9']);

    RecordingHost::mountView('whats-new-sheet', ['visible' => true]);

    expect(app(GetAppPreferences::class)()->whatsNewSeenVersion)->toBe('');
});
