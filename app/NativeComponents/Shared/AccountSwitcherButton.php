<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use AltUU\Domains\Account\Actions\ListAccounts;
use AltUU\Domains\Auth\Actions\GetSessionProfile;
use AltUU\Domains\Auth\ViewModels\SessionProfileViewModel;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Throwable;

/**
 * Avatar + name pill that opens the account pane on tap and the quick
 * switcher on long press (AccountSwitcherButton.vue).
 *
 * Tag: `<native:account-switcher-button key="account-switcher-button" return-to="/courses" @switched="reloadAfterSwitch" />`
 * Props: `returnTo` (passed on to the switcher, see AccountSwitcherSheet).
 * Events: `switched` (new account id) re-emitted from the embedded
 * AccountSwitcherSheet, after this button has refreshed its own profile.
 * Long press is ignored while only one account exists. The button mounts its
 * own AccountSwitcherSheet; the host only reacts to `switched`.
 */
final class AccountSwitcherButton extends NativeComponent
{
    public string $returnTo = '';

    public ?SessionProfileViewModel $profile = null;

    public bool $menuOpen = false;

    public function mount(): void
    {
        $this->loadProfile();
    }

    public function onResume(): void
    {
        $this->loadProfile();
    }

    public function open(): void
    {
        $this->navigate($this->route('native.courses.account'));
    }

    public function openMenu(): void
    {
        if (count(app(ListAccounts::class)()) > 1) {
            $this->menuOpen = true;
        }
    }

    public function closeMenu(): void
    {
        $this->menuOpen = false;
    }

    public function onSwitched(int $accountId): void
    {
        $this->menuOpen = false;
        $this->loadProfile();
        $this->emit('switched', $accountId);
    }

    public function label(): string
    {
        return $this->profile?->nickname
            ?? $this->profile?->username
            ?? $this->profile?->displayName
            ?? '帳號';
    }

    public function render(): View
    {
        return view('native.shared.account-switcher-button', ['label' => $this->label()]);
    }

    private function loadProfile(): void
    {
        try {
            $this->profile = app(GetSessionProfile::class)();
        } catch (Throwable) {
            $this->profile = null;
        }
    }
}
