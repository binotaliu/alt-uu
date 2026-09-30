<?php

declare(strict_types=1);

namespace App\NativeComponents\Concerns;

use AltUU\Domains\Account\Actions\SwitchAccount;
use App\Models\Account;
use App\Services\NativeSessionGuard;
use Throwable;

/**
 * Account switching shared by AccountSwitcherSheet and SessionExpiredPicker
 * (the native useAccountSwitcher composable).
 *
 * Outcomes of `switchToAccount()`:
 *  - success: re-primes the session profile, toasts 已切換帳號, emits
 *    `switched` (account id). The host must reload whatever it showed for
 *    the previous account (the Pinia `refreshAppStateAfterAccountChange`
 *    equivalent); PHP-side caches are keyed per account, so no reset call is
 *    needed.
 *  - the target account's own session is dead ("已失效"): navigates to
 *    `native.reauth` with `['accountId' => id]` and data `['returnTo' => $returnTo]`.
 *  - anything else: toasts the error message.
 */
trait SwitchesAccounts
{
    use ShowsToasts;

    public ?int $switchingAccountId = null;

    /** URI the reauth screen should return to (the screen that was open). */
    public string $returnTo = '';

    protected function switchToAccount(int $accountId): bool
    {
        if ($this->switchingAccountId !== null) {
            return false;
        }

        $this->switchingAccountId = $accountId;

        try {
            return $this->performSwitch($accountId);
        } catch (Throwable) {
            $this->toastError('切換帳號失敗，請稍後再試。');

            return false;
        } finally {
            $this->switchingAccountId = null;
        }
    }

    private function performSwitch(int $accountId): bool
    {
        $account = Account::query()->find($accountId);

        if ($account === null) {
            $this->toastError('切換帳號失敗，請稍後再試。');

            return false;
        }

        $result = app(SwitchAccount::class)($account);

        if ($result->ok) {
            app(NativeSessionGuard::class)->check();
            $this->toastSuccess('已切換帳號');
            $this->emit('switched', $accountId);

            return true;
        }

        if (str_contains($result->message, '已失效')) {
            $this->navigate(
                $this->route('native.reauth', ['accountId' => $accountId]),
                ['returnTo' => $this->returnTo],
            );

            return false;
        }

        $this->toastError($result->message !== '' ? $result->message : '切換帳號失敗。');

        return false;
    }
}
