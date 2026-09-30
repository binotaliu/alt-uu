<?php

declare(strict_types=1);

namespace App\NativeComponents\Concerns;

use App\Services\NativeSessionGuard;
use App\Services\NativeSessionGuardResult;

/**
 * Session guard for NativeComponent screens that need a logged-in account.
 *
 * Call it first in `mount()` (and `onResume()` if the screen can outlive a
 * session expiry):
 *
 *     public function mount(): void
 *     {
 *         if (! $this->ensureHunguSession()) {
 *             return;
 *         }
 *         // load data...
 *     }
 */
trait GuardsHunguSession
{
    /**
     * Returns true when the screen may proceed. Otherwise the screen has
     * already been replaced by native.reauth (an account whose session died)
     * or native.login (no usable account), and the caller should return.
     */
    protected function ensureHunguSession(bool $validateRemotely = false): bool
    {
        $result = $this->hunguSessionGuardResult($validateRemotely);

        if ($result->proceeds) {
            return true;
        }

        $this->replace($this->route((string) $result->redirectRoute, $result->redirectParameters));

        return false;
    }

    protected function hunguSessionGuardResult(bool $validateRemotely = false): NativeSessionGuardResult
    {
        return app(NativeSessionGuard::class)->check($validateRemotely);
    }
}
