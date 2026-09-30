<?php

declare(strict_types=1);

namespace App\NativeComponents\Account;

use AltUU\Domains\Account\Actions\AddAccount;
use AltUU\Domains\Account\Actions\ListAccounts;
use AltUU\Domains\Account\Actions\RemoveAccount;
use AltUU\Domains\Account\Actions\RenameAccount;
use AltUU\Domains\Account\DataTransferObjects\AddAccountInputData;
use AltUU\Domains\Account\Exceptions\AccountLimitExceededException;
use AltUU\Domains\Account\ViewModels\AccountViewModel;
use App\Models\Account;
use App\NativeComponents\Concerns\GuardsHunguSession;
use App\NativeComponents\Concerns\SwitchesAccounts;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Throwable;

/**
 * Account management (Account/Accounts.vue): add, switch, rename and remove
 * accounts, up to five per device.
 *
 * Deliberately not session guarded: this screen is how a user gets out of a
 * dead session, so it only needs the account list, never an upstream call.
 * Removing the last account replaces the screen with the login screen;
 * removing the active one falls back to the guard so a dead next account
 * lands on reauth.
 */
final class Accounts extends NativeComponent
{
    use GuardsHunguSession;
    use SwitchesAccounts;

    public const int MAX_ACCOUNTS = 5;

    private const int NICKNAME_MAX_LENGTH = 30;

    /** @var array<int, AccountViewModel> */
    public array $accounts = [];

    public ?int $expandedAccountId = null;

    public bool $addFormVisible = false;

    public string $addUsername = '';

    public string $addPassword = '';

    public bool $addProcessing = false;

    public string $addError = '';

    public ?int $pendingRemovalId = null;

    public bool $removing = false;

    public ?int $renamingAccountId = null;

    public string $renameInitialValue = '';

    public bool $renameProcessing = false;

    public string $renameError = '';

    public function navTitle(): string
    {
        return '切換帳號';
    }

    public function mount(): void
    {
        $this->returnTo = $this->route('native.courses.account.accounts');
        $this->loadAccounts();

        if ($this->accounts === []) {
            $this->replace($this->route('native.login'));
        }
    }

    public function onResume(): void
    {
        $this->loadAccounts();
    }

    public function toggleExpanded(int $accountId): void
    {
        $this->expandedAccountId = $this->expandedAccountId === $accountId ? null : $accountId;
    }

    public function toggleAddForm(): void
    {
        $this->addFormVisible = ! $this->addFormVisible;
        $this->addUsername = '';
        $this->addPassword = '';
        $this->addError = '';
    }

    public function submitAddAccount(): void
    {
        if ($this->addProcessing) {
            return;
        }

        $this->addProcessing = true;
        $this->addError = '';

        try {
            $input = AddAccountInputData::validateAndCreate([
                'username' => trim($this->addUsername),
                'password' => $this->addPassword,
            ]);

            $result = app(AddAccount::class)($input);

            if (! $result->ok) {
                $this->addError = $result->message !== '' ? $result->message : '新增帳號失敗，請稍後再試。';

                return;
            }

            $this->accounts = $result->accounts;
            $this->addFormVisible = false;
            $this->addUsername = '';
            $this->addPassword = '';
            $this->toastSuccess('已新增帳號');
        } catch (ValidationException $exception) {
            $this->addError = (string) collect($exception->errors())->flatten()->first();
        } catch (AccountLimitExceededException $exception) {
            $this->addError = $exception->getMessage();
        } catch (Throwable) {
            $this->addError = '新增帳號失敗，請稍後再試。';
        } finally {
            $this->addProcessing = false;
        }
    }

    public function switchAccount(int $accountId): void
    {
        $switched = $this->switchToAccount($accountId);

        $this->loadAccounts();

        if ($switched) {
            $this->navigate($this->route('native.courses.index'));
        }
    }

    public function askRemove(int $accountId): void
    {
        $this->pendingRemovalId = $accountId;
    }

    public function cancelRemove(): void
    {
        if (! $this->removing) {
            $this->pendingRemovalId = null;
        }
    }

    public function confirmRemove(): void
    {
        $accountId = $this->pendingRemovalId;

        if ($accountId === null || $this->removing) {
            return;
        }

        $this->removing = true;

        try {
            $account = Account::query()->find($accountId);

            if ($account === null) {
                $this->loadAccounts();
                $this->toastError('找不到這個帳號。');

                return;
            }

            $wasActive = collect($this->accounts)
                ->first(fn (AccountViewModel $item): bool => $item->id === $accountId)
                ?->isActive ?? false;

            $this->accounts = app(RemoveAccount::class)($account);
            $this->expandedAccountId = null;
        } catch (Throwable) {
            $this->loadAccounts();
            $this->toastError('移除帳號失敗，請稍後再試。');

            return;
        } finally {
            $this->removing = false;
            $this->pendingRemovalId = null;
        }

        if (! $wasActive) {
            return;
        }

        if ($this->accounts === []) {
            $this->replace($this->route('native.login'));

            return;
        }

        $this->ensureHunguSession();
    }

    public function openRename(int $accountId): void
    {
        $account = collect($this->accounts)->first(fn (AccountViewModel $item): bool => $item->id === $accountId);

        if ($account === null) {
            return;
        }

        $this->renameInitialValue = $account->nickname ?? '';
        $this->renameError = '';
        $this->renamingAccountId = $accountId;
    }

    public function cancelRename(): void
    {
        if (! $this->renameProcessing) {
            $this->renamingAccountId = null;
        }
    }

    public function saveRename(string $value): void
    {
        if ($this->renamingAccountId === null || $this->renameProcessing) {
            return;
        }

        $nickname = trim($value);

        if (mb_strlen($nickname) > self::NICKNAME_MAX_LENGTH) {
            $this->renameError = '自訂名稱長度不可超過 30 個字。';

            return;
        }

        $this->renameProcessing = true;
        $this->renameError = '';

        try {
            $account = Account::query()->find($this->renamingAccountId);

            if ($account === null) {
                $this->renameError = '找不到這個帳號。';

                return;
            }

            $this->accounts = app(RenameAccount::class)($account, $nickname);
            $this->renamingAccountId = null;
        } catch (Throwable) {
            $this->renameError = '修改名稱失敗，請稍後再試。';
        } finally {
            $this->renameProcessing = false;
        }
    }

    public function render(): View
    {
        return view('native.account.accounts', [
            'limitReached' => count($this->accounts) >= self::MAX_ACCOUNTS,
        ]);
    }

    private function loadAccounts(): void
    {
        $this->accounts = app(ListAccounts::class)();
    }
}
