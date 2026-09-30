<?php

declare(strict_types=1);

namespace Tests\Feature\Native\Fixtures;

use App\NativeComponents\Concerns\ShowsSessionExpiredPicker;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * Test-only screen using the session-expired picker trait.
 */
final class SessionExpiryHost extends NativeComponent
{
    use ShowsSessionExpiredPicker;

    public bool $diverted = false;

    public ?int $switchedTo = null;

    public function expire(): void
    {
        $this->diverted = $this->handleSessionExpired();
    }

    protected function onAccountSwitched(int $accountId): void
    {
        $this->switchedTo = $accountId;
    }

    public function render(): View
    {
        app('view')->addNamespace('native-fixtures', __DIR__.'/views');

        return view('native-fixtures::session-expiry-host');
    }
}
