<?php

declare(strict_types=1);

use App\NativeComponents\Auth\Login;
use App\NativeLayouts\FormStackLayout;
use App\NativeLayouts\GuestLayout;
use App\NativeLayouts\MainTabsLayout;
use App\NativeLayouts\StackLayout;
use Illuminate\Support\Facades\Route;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Edge\NativeRouter;

it('mounts every native route at a plain URI', function (): void {
    $patterns = array_keys(NativeRouter::registeredRoutes());

    expect($patterns)->toHaveCount(20);

    foreach ($patterns as $pattern) {
        expect($pattern)->not->toStartWith('/native');
    }
});

it('names every screen with the native. prefix', function (): void {
    $vueNames = [
        'login', 'onboarding', 'reauth', 'courses.index', 'courses.live-sessions',
        'courses.school-calendar', 'courses.account', 'courses.account.accounts',
        'courses.account.subscription', 'courses.account.data-export',
        'courses.account.grades', 'courses.account.exam-info', 'courses.show',
        'courses.discuss.board.show', 'courses.discuss.thread.show',
        'courses.material.show', 'settings', 'settings.diagnostics',
        'settings.diagnostics-log', 'settings.material-source',
    ];

    foreach ($vueNames as $name) {
        expect(Route::has("native.{$name}"))->toBeTrue("native.{$name} missing");
    }
});

it('has no SPA shell or catch-all left', function (): void {
    expect(Route::has('spa'))->toBeFalse()
        ->and(Route::has('login'))->toBeFalse()
        ->and(view()->exists('app'))->toBeFalse();
});

it('serves the start url from a native route', function (): void {
    expect(NativeRouter::isNativeRoute(config('nativephp.start_url')))->toBeTrue();
});

it('registers layouts per route group', function (): void {
    $layouts = collect(NativeRouter::registeredRoutes())->map(fn (array $entry): ?string => $entry['layout'] ?? null);

    expect($layouts['/login'])->toBe(GuestLayout::class)
        ->and($layouts['/courses'])->toBe(MainTabsLayout::class)
        ->and($layouts['/courses/account'])->toBe(MainTabsLayout::class)
        ->and($layouts['/courses/account/accounts'])->toBe(FormStackLayout::class)
        ->and($layouts['/courses/{cid}'])->toBe(StackLayout::class);
});

it('resolves static segments before {param} siblings', function (): void {
    $stubbed = fn (string $uri): ?string => collect(NativeRouter::registeredRoutes())
        ->filter(fn (array $entry): bool => $entry['route']->matches(Request::create($uri)))
        ->keys()
        ->sortBy(fn (string $pattern): int => str_contains($pattern, '{') ? 1 : 0)
        ->first();

    expect($stubbed('/courses/account/accounts'))->toBe('/courses/account/accounts')
        ->and($stubbed('/courses/live-sessions'))->toBe('/courses/live-sessions');

    $resolved = NativeRouter::resolve('/login');
    expect($resolved['class'])->toBe(Login::class);
});

it('resolves every native route to a screen class with a layout', function (): void {
    $sampleParams = ['accountId' => '1', 'cid' => '10', 'boardCid' => '20', 'bid' => '30', 'nid' => '40', 'scoid' => '50'];

    foreach (NativeRouter::registeredRoutes() as $pattern => $entry) {
        $uri = (string) preg_replace_callback(
            '/\{(\w+)\}/',
            fn (array $match): string => $sampleParams[$match[1]],
            $pattern,
        );

        $resolved = NativeRouter::resolve($uri);

        expect($resolved)->not->toBeNull("{$pattern} did not resolve")
            ->and(class_exists($resolved['class']))->toBeTrue("{$pattern} class missing")
            ->and(is_subclass_of($resolved['class'], NativeComponent::class))->toBeTrue()
            ->and($resolved['layout'])->not->toBeNull();
    }
});

it('has a screen class for every native route', function (): void {
    $missing = collect(NativeRouter::registeredRoutes())
        ->filter(fn (array $entry): bool => ! class_exists($entry['class'] ?? ''))
        ->keys()
        ->all();

    expect($missing)->toBe([]);
});
