<?php

declare(strict_types=1);

namespace App\NativeLayouts;

use Native\Mobile\Edge\Layouts\NativeLayout;

/**
 * Chrome-less layout for login and onboarding. Screens using it may apply
 * `safe-area` classes themselves.
 */
final class GuestLayout extends NativeLayout
{
    public function usesNativeChrome(): bool
    {
        return false;
    }
}
