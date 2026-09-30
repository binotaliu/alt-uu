<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use AltUU\Domains\Account\ViewModels\AccountViewModel;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * Account row: avatar, name, school display name and an optional trailing
 * label (AccountListItem.vue).
 *
 * Tag: `<native:account-list-item key="account-{{ $a->id }}" :account="$a" trailing-label="目前帳號" :disabled="$busy" />`
 * Props: `account` (AccountViewModel), `trailingLabel`, `disabled`.
 * Events: `selected` (account id).
 */
final class AccountListItem extends NativeComponent
{
    public ?AccountViewModel $account = null;

    public string $trailingLabel = '';

    public bool $disabled = false;

    public function select(): void
    {
        if ($this->account === null || $this->disabled) {
            return;
        }

        $this->emit('selected', $this->account->id);
    }

    public function render(): View
    {
        return view('native.shared.account-list-item');
    }
}
