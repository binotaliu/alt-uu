<?php

declare(strict_types=1);

use App\NativeComponents\Auth\Login;
use Native\Mobile\Testing\Native;

it('renders the login screen as native UI without a web view', function (): void {
    Native::test(Login::class)
        ->assertSee('登入 NOU UU 平台')
        ->assertMissingElement('native:web-view');
});
