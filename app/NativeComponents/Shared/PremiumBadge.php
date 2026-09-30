<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * "Alt UU+" pill shown next to subscriber-only features.
 *
 * Tag: `<native:premium-badge />`. No props, no events.
 */
final class PremiumBadge extends NativeComponent
{
    public function render(): View
    {
        return view('native.shared.premium-badge');
    }
}
