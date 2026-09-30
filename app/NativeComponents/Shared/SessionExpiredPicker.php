<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use AltUU\Domains\Account\Actions\ListAccounts;
use AltUU\Domains\Account\ViewModels\AccountViewModel;
use App\NativeComponents\Concerns\SwitchesAccounts;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * "登入已失效" sheet offering another account or a fresh login for the dead
 * one (SessionExpiredPicker.vue).
 *
 * Tag: `<native:session-expired-picker key="session-expired" :visible="$sessionPickerVisible" :failed-account-id="$sessionPickerFailedAccountId" failed-account-name="小明" return-to="/courses" @cancel="closeSessionPicker" @switched="onSessionAccountSwitched" />`
 * Hosts using the `ShowsSessionExpiredPicker` trait get the props and the two
 * handler methods for free.
 *
 * Props: `visible`, `failedAccountId` (null hides the re-login link),
 * `failedAccountName` (optional; when empty it is looked up in the account
 * list, then falls back to 目前帳號), `returnTo` (URI for the reauth screen).
 * Events: `cancel`, `switched` (new account id).
 * The re-login link navigates to `native.reauth` with data
 * `['returnTo' => returnTo]` and emits `cancel`.
 */
final class SessionExpiredPicker extends NativeComponent
{
    use SwitchesAccounts;

    public bool $visible = false;

    public ?int $failedAccountId = null;

    public string $failedAccountName = '';

    /** @var array<int, AccountViewModel> */
    public array $accounts = [];

    private bool $wasVisible = false;

    public function select(int $accountId): void
    {
        $this->switchToAccount($accountId);
    }

    public function reauthenticate(): void
    {
        if ($this->failedAccountId === null) {
            return;
        }

        $this->emit('cancel');
        $this->navigate(
            $this->route('native.reauth', ['accountId' => $this->failedAccountId]),
            ['returnTo' => $this->returnTo],
        );
    }

    public function cancel(): void
    {
        $this->emit('cancel');
    }

    public function render(): View
    {
        if ($this->visible && ! $this->wasVisible) {
            $this->accounts = app(ListAccounts::class)();
        }

        $this->wasVisible = $this->visible;

        $failed = collect($this->accounts)->first(
            fn (AccountViewModel $account): bool => $account->id === $this->failedAccountId,
        );

        $name = $this->failedAccountName !== ''
            ? $this->failedAccountName
            : ($failed?->nickname ?? $failed?->displayName ?? $failed?->username ?? '目前帳號');

        return view('native.shared.session-expired-picker', [
            'failedName' => $name,
            'otherAccounts' => array_values(array_filter(
                $this->accounts,
                fn (AccountViewModel $account): bool => $account->id !== $this->failedAccountId,
            )),
        ]);
    }
}
