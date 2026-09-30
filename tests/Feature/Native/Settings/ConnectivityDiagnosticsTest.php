<?php

declare(strict_types=1);

use App\NativeComponents\Settings\ConnectivityDiagnostics;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Native\Mobile\Testing\Native;
use Native\Mobile\Testing\TestableComponent;

function runAllChecks(TestableComponent $test, int $maxTicks = 12): TestableComponent
{
    for ($i = 0; $i < $maxTicks; $i++) {
        $test->firePolls();
    }

    return $test;
}

it('runs the service checks one per tick and reports all reachable', function (): void {
    Http::fake(['*' => Http::response('ok', 200)]);
    $bridge = Native::fakeBridge()->withWifi();

    $test = Native::test(ConnectivityDiagnostics::class)
        ->assertSee('正在檢查各項服務連線狀態…')
        ->assertSee('檢查中…')
        ->assertSee('尚未執行檢查');

    runAllChecks($test)
        ->assertSee('所有服務均可正常連線。')
        ->assertSee('數位學習平台 (UU平台)')
        ->assertSee('教務行政資訊系統')
        ->assertSee('NOU 小幫手')
        ->assertSee('Alt UU+ 服務')
        ->assertSee('Wi-Fi')
        ->assertSet('checking', false)
        ->assertNoNavigation();

    $bridge->assertCalled('Network.Status');
});

it('warns about unreachable services and errors when the school platform is down', function (): void {
    Http::fake(function ($request) {
        if (str_starts_with($request->url(), (string) config('hungu.base_url'))) {
            throw new ConnectionException('連線逾時');
        }

        return Http::response('ok', 200);
    });
    Native::fakeBridge()->withWifi();

    $test = runAllChecks(Native::test(ConnectivityDiagnostics::class));

    $test->assertSee('由於無法連線到數位學習平台，因此無法使用 Alt UU')
        ->assertSee('連線逾時');
});

it('shows an offline message and no service rows without a network', function (): void {
    Http::fake();
    Native::fakeBridge()->withOffline();

    Native::test(ConnectivityDiagnostics::class)
        ->assertSee('您的裝置目前沒有網路連線')
        ->assertSee('已偵測到裝置離線')
        ->assertSet('awaitingNetwork', true)
        ->assertSet('rows', []);

    Http::assertNothingSent();
});

it('restarts the checks once the network comes back', function (): void {
    Http::fake(['*' => Http::response('ok', 200)]);
    $bridge = Native::fakeBridge()->withOffline();

    $test = Native::test(ConnectivityDiagnostics::class)->assertSet('awaitingNetwork', true);

    $bridge->withWifi();
    $test->set('lastNetworkPollAt', microtime(true) - 10)->firePolls()->assertSet('awaitingNetwork', false);

    runAllChecks($test)->assertSee('所有服務均可正常連線。');
});

it('does not poll the network more often than every three seconds while offline', function (): void {
    Native::fakeBridge()->withOffline();

    $test = Native::test(ConnectivityDiagnostics::class);
    $calls = count(Native::fakeBridge()->callsTo('Network.Status'));

    $test->firePolls()->firePolls();

    expect(count(Native::fakeBridge()->callsTo('Network.Status')))->toBe($calls);
});

it('checks the optional internet reference services on request', function (): void {
    Http::fake(['*' => Http::response('ok', 200)]);
    Native::fakeBridge()->withWifi();

    $test = runAllChecks(Native::test(ConnectivityDiagnostics::class))
        ->assertSee('網際網路連線（選用）')
        ->assertSee('Google')
        ->assertSee('尚未執行檢查');

    $test->tap('check-reference')->assertSet('checkingReference', true);

    runAllChecks($test)->assertSet('checkingReference', false)->assertDontSee('尚未執行檢查');
});

it('re-runs everything from the recheck button', function (): void {
    Http::fake(['*' => Http::response('ok', 200)]);
    Native::fakeBridge()->withWifi();

    $test = runAllChecks(Native::test(ConnectivityDiagnostics::class));

    $test->tap('recheck')->assertSee('正在檢查各項服務連線狀態…');

    runAllChecks($test)->assertSee('所有服務均可正常連線。');
});

it('marks a row failed when a check throws unexpectedly', function (): void {
    Http::fake(fn () => throw new RuntimeException('boom'));
    Native::fakeBridge()->withWifi();

    runAllChecks(Native::test(ConnectivityDiagnostics::class))
        ->assertSee('檢查失敗，請稍後再試。')
        ->assertSet('checking', false);
});
