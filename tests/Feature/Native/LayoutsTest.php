<?php

declare(strict_types=1);

use App\NativeComponents\Auth\Login;
use App\NativeLayouts\FormStackLayout;
use App\NativeLayouts\GuestLayout;
use App\NativeLayouts\MainTabsLayout;
use App\NativeLayouts\StackLayout;
use Native\Mobile\Testing\Native;

it('gives the main tabs layout four tabs and native chrome', function (): void {
    $screen = Native::test(Login::class)->instance();
    $layout = new MainTabsLayout;

    expect($layout->usesNativeChrome())->toBeTrue()
        ->and($layout->tabBar($screen)->getTabs())->toHaveCount(4)
        ->and($layout->navBar($screen))->not->toBeNull();
});

it('gives pushed layouts a nav bar and no tab bar', function (string $layoutClass): void {
    $screen = Native::test(Login::class)->instance();
    $layout = new $layoutClass;

    expect($layout->navBar($screen))->not->toBeNull()
        ->and($layout->tabBar($screen))->toBeNull();
})->with([StackLayout::class, FormStackLayout::class]);

it('renders the guest layout without chrome', function (): void {
    $screen = Native::test(Login::class)->instance();
    $layout = new GuestLayout;

    expect($layout->navBar($screen))->toBeNull()
        ->and($layout->tabBar($screen))->toBeNull();
});
