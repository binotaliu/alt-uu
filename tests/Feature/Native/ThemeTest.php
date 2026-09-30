<?php

declare(strict_types=1);

use App\Services\NativeAccent;
use Native\Mobile\Edge\TailwindParser;
use Native\Mobile\Testing\Native;
use Native\Mobile\UI\Theme;

beforeEach(function (): void {
    Theme::reset();
    Theme::fonts(config('native-ui.fonts', []));
    Theme::load(config('native-ui.theme', []));
});

it('defines every role in both light and dark', function (): void {
    $light = array_keys(config('native-ui.theme.light'));
    $dark = array_keys(config('native-ui.theme.dark'));

    expect($dark)->toEqualCanonicalizing($light);
    expect($light)->toContain('success', 'warning', 'destructive', 'outline-variant', 'primary-container');
});

it('resolves palette-named roles to colors', function (): void {
    foreach (['light', 'dark'] as $mode) {
        foreach (array_keys(config("native-ui.theme.{$mode}")) as $role) {
            expect(Theme::get("{$mode}.{$role}"))->toStartWith('#');
        }
    }
});

it('lists the seven accents with Traditional Chinese labels', function (): void {
    expect(app(NativeAccent::class)->options())->toBe([
        'warm' => '暖橘', 'ocean' => '海藍', 'forest' => '森綠', 'purple' => '皇紫',
        'pink' => '粉紅', 'red' => '緋紅', 'grey' => '銀灰',
    ]);
});

it('applies an accent at runtime and falls back to warm', function (): void {
    $warm = Theme::get('light.primary');
    $accent = app(NativeAccent::class);

    expect($accent->apply('ocean'))->toBe('ocean');
    expect(Theme::get('light.primary'))->toBe('#005D84')->not->toBe($warm);
    expect(Theme::get('dark.surface'))->toStartWith('#');

    expect($accent->apply('nope'))->toBe('warm');
    expect(Theme::get('light.primary'))->toBe($warm);
});

it('tints the iOS window with the accent through the media-player plugin', function (): void {
    $bridge = Native::fakeBridge();

    app(NativeAccent::class)->apply('ocean');
    app(NativeAccent::class)->apply('nope');

    $bridge->assertCalled('AppAccent.SetColor', fn (array $params): bool => $params['accent'] === 'ocean');
    $bridge->assertCalled('AppAccent.SetColor', fn (array $params): bool => $params['accent'] === 'warm');
});

it('parses theme token classes', function (): void {
    expect(TailwindParser::parse('bg-theme-success text-theme-on-warning border-theme-outline-variant'))->not->toBeEmpty();
});
