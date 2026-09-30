<?php

declare(strict_types=1);

use App\NativeComponents\Shared\PremiumBadge;
use Native\Mobile\Testing\Native;
use Tests\Feature\Native\Fixtures\RecordingHost;

it('renders the Alt UU+ pill', function (): void {
    Native::test(PremiumBadge::class)
        ->assertSee('Alt UU+')
        ->assertElement('icon');
});

it('mounts through its tag', function (): void {
    RecordingHost::mountView('premium-badge')->assertSee('Alt UU+');
});
