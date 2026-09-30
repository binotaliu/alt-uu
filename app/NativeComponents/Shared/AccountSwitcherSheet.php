<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use AltUU\Domains\Account\Actions\ListAccounts;
use AltUU\Domains\Account\ViewModels\AccountViewModel;
use App\NativeComponents\Concerns\SwitchesAccounts;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * Quick account switcher sheet (the menu of AccountSwitcherButton.vue).
 *
 * Tag: `<native:account-switcher-sheet key="account-switcher" :visible="$switcherOpen" return-to="/native/courses" @cancel="closeSwitcher" @switched="onAccountSwitched" />`
 *
 * Props: `visible`, `returnTo` (URI handed to native.reauth when the picked
 * account's session is dead).
 * Events: `cancel` (dismissed, or the manage-accounts link was followed),
 * `switched` (new account id, after the session is active and re-primed).
 * Behaviour: the account list is reloaded every time the sheet opens; picking
 * the active account just emits `cancel`. See SwitchesAccounts for the switch
 * outcomes (toast, reauth navigation).
 *
 * REQUIRED host actions: set `visible` false on `cancel` and `switched`;
 * on `switched` reload the data of the current screen.
 */
final class AccountSwitcherSheet extends NativeComponent
{
    use SwitchesAccounts;

    public bool $visible = false;

    /** @var array<int, AccountViewModel> */
    public array $accounts = [];

    private bool $wasVisible = false;

    public function select(int $accountId): void
    {
        $account = collect($this->accounts)->first(fn (AccountViewModel $item): bool => $item->id === $accountId);

        if ($account === null || $account->isActive) {
            $this->emit('cancel');

            return;
        }

        $this->switchToAccount($accountId);
    }

    public function manage(): void
    {
        $this->emit('cancel');
        $this->navigate($this->route('native.courses.account'));
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

        return view('native.shared.account-switcher-sheet');
    }
}
