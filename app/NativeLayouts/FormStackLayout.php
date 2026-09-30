<?php

declare(strict_types=1);

namespace App\NativeLayouts;

use Native\Mobile\Edge\Layouts\Builders\NavBar;
use Native\Mobile\Edge\Layouts\NativeLayout;
use Native\Mobile\Edge\NativeComponent;

/**
 * Form-style pushed screens (re-authentication, data import/export,
 * subscription): like StackLayout but on the card surface colour so inputs
 * and grouped rows sit on a consistent plane.
 */
final class FormStackLayout extends NativeLayout
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
            ->backgroundColor(theme('surface'))
            ->textColor(theme('on-surface'));
    }
}
