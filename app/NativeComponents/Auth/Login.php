<?php

declare(strict_types=1);

namespace App\NativeComponents\Auth;

use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * Placeholder shell: the real login form is built in the auth screen group.
 */
final class Login extends NativeComponent
{
    public function render(): View
    {
        return view('native.auth.login');
    }
}
