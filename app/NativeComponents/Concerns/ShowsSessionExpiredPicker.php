<?php

declare(strict_types=1);

namespace App\NativeComponents\Concerns;

use AltUU\Domains\Account\Actions\ListAccounts;
use App\Services\NativeSessionGuard;

/**
 * Lets a screen show the SessionExpiredPicker instead of hard-redirecting when
 * its session dies mid-use (the native counterpart of the SPA's session
 * expiry store).
 *
 * Call `handleSessionExpired()` when an Action reports a 401 / the session is
 * gone (usually from `onResume()` or a catch block). It runs the session guard
 * once:
 *  - session fine: returns false, carry on;
 *  - an account failed and other accounts exist: opens the picker, returns true;
 *  - otherwise: replaces the screen with native.reauth / native.login, returns true.
 *
 * Render the picker in the screen view:
 *
 *     <native:session-expired-picker
 *         key="session-expired"
 *         :visible="$sessionPickerVisible"
 *         :failed-account-id="$sessionPickerFailedAccountId"
 *         return-to="{{ $this->route('native.courses.index') }}"
 *
 *         @cancel="closeSessionPicker"
 *
 *         @switched="onSessionPickerSwitched"
 *     />
 *
 * After a switch the host reloads its data by overriding `onAccountSwitched()`.
 */
trait ShowsSessionExpiredPicker
{
    public bool $sessionPickerVisible = false;

    public ?int $sessionPickerFailedAccountId = null;

    protected function handleSessionExpired(): bool
    {
        $result = app(NativeSessionGuard::class)->check();

        if ($result->proceeds) {
            return false;
        }

        if ($result->failedAccountId !== null && app(ListAccounts::class)() !== []) {
            $this->sessionPickerFailedAccountId = $result->failedAccountId;
            $this->sessionPickerVisible = true;

            return true;
        }

        $this->replace($this->route((string) $result->redirectRoute, $result->redirectParameters));

        return true;
    }

    public function closeSessionPicker(): void
    {
        $this->sessionPickerVisible = false;
    }

    public function onSessionPickerSwitched(int $accountId): void
    {
        $this->sessionPickerVisible = false;
        $this->sessionPickerFailedAccountId = null;
        $this->onAccountSwitched($accountId);
    }

    protected function onAccountSwitched(int $accountId): void {}
}
