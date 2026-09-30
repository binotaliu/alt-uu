<?php

declare(strict_types=1);

namespace App\NativeLayouts;

use Native\Mobile\Edge\Layouts\Builders\NavBar;
use Native\Mobile\Edge\Layouts\NativeLayout;
use Native\Mobile\Edge\NativeComponent;

/**
 * Pushed detail screens (course, material, discussion, settings, account
 * sub-pages): back-arrow nav bar, no tab bar.
 */
final class StackLayout extends NativeLayout
{
    public function usesNativeChrome(): bool
    {
        return true;
    }

    public function navBar(NativeComponent $screen): ?NavBar
    {
        return NavBar::make()
            ->title($screen->navTitle())
            ->back()
            ->displayMode('inline')
            ->backgroundColor(theme('background'))
            ->textColor(theme('on-background'));
    }
}
