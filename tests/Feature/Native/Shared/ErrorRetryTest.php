<?php

declare(strict_types=1);

use App\NativeComponents\Shared\ErrorRetry;
use Illuminate\Support\Facades\Cache;
use Native\Mobile\Testing\Native;
use Tests\Feature\Native\Fixtures\RecordingHost;

it('shows the message and emits retry when tapped', function (): void {
    $host = RecordingHost::mountView('error-retry', ['message' => '載入失敗']);

    $host->assertSee('載入失敗')->assertSee('重試')->tap('retry');

    expect($host->get('events'))->toBe([['retry']]);
});

it('does not emit retry while retrying', function (): void {
    $host = RecordingHost::mountView('error-retry', ['message' => '載入失敗', 'retrying' => true]);

    $host->assertSee('重試中…')->tap('retry');

    expect($host->get('events'))->toBe([]);
});

it('reveals structured details on demand', function (): void {
    $detail = [
        'displayCode' => 'NET-01',
        'stageLabel' => '網路',
        'operationLabel' => '取得課程',
        'method' => 'GET',
        'url' => '/api/courses',
        'durationMs' => 120,
        'status' => 502,
        'requestId' => 'req-1',
    ];

    Native::test(ErrorRetry::class)
        ->set('message', '失敗')
        ->set('detail', $detail)
        ->assertSee('[NET-01]')
        ->assertDontSee('取得課程')
        ->tap('toggle-detail')
        ->assertSee('取得課程')
        ->assertSee('GET /api/courses · 120ms')
        ->assertSee('502')
        ->assertSee('隱藏詳細資料')
        ->tap('open-log')
        ->assertNavigatedTo('/settings/diagnostics/log');
});

it('hides the detail toggle when there is no detail', function (): void {
    Native::test(ErrorRetry::class)
        ->set('message', '失敗')
        ->assertDontSee('詳細資料');
});

function promptSheetVisible(mixed $screen): bool
{
    return $screen->get('connectivityPromptVisible') === true;
}

it('suggests the diagnostics after three quick retries', function (): void {
    Cache::flush();
    $screen = Native::test(ErrorRetry::class)->set('message', '失敗');

    $screen->tap('retry')->tap('retry');
    expect(promptSheetVisible($screen))->toBeFalse();

    $screen->tap('retry')->assertSet('connectivityPromptVisible', true);
});

it('opens the diagnostics from the prompt and stays quiet afterwards', function (): void {
    Cache::flush();
    $screen = Native::test(ErrorRetry::class)->set('message', '失敗');

    $screen->tap('retry')->tap('retry')->tap('retry')
        ->tap('connectivity-confirm')
        ->assertSet('connectivityPromptVisible', false)
        ->assertNavigatedTo('/settings/diagnostics');

    $quiet = Native::test(ErrorRetry::class)->set('message', '失敗');
    $quiet->tap('retry')->tap('retry')->tap('retry')->assertSet('connectivityPromptVisible', false);
});

it('closes the prompt with 稍後再說 and stays quiet', function (): void {
    Cache::flush();
    $screen = Native::test(ErrorRetry::class)->set('message', '失敗');

    $screen->tap('retry')->tap('retry')->tap('retry')
        ->tap('connectivity-cancel')
        ->assertSet('connectivityPromptVisible', false)
        ->assertNoNavigation();

    $screen->tap('retry')->tap('retry')->tap('retry')->assertSet('connectivityPromptVisible', false);
});
