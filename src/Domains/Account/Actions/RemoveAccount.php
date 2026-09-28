<?php

declare(strict_types=1);

namespace AltUU\Domains\Account\Actions;

use AltUU\Domains\Account\ViewModels\AccountViewModel;
use AltUU\Domains\Diagnostics\Actions\ForgetDiagnosticLog;
use App\Models\Account;
use App\Services\AccountManager;
use Illuminate\Http\Request;

final readonly class RemoveAccount
{
    public function __construct(
        private AccountManager $accounts,
        private ListAccounts $listAccounts,
        private ForgetDiagnosticLog $forgetDiagnosticLog,
    ) {}

    /**
     * @return array<int, AccountViewModel>
     */
    public function __invoke(Request $request, Account $account): array
    {
        $wasActive = $this->accounts->activeId() === $account->id;

        $this->accounts->forget($account->id);

        // The log is not scoped per account, so the removed account's request
        // history can only be dropped by clearing all of it. Recording is
        // left running: removing an account is itself a plausible thing to be
        // diagnosing, and the window is a device setting rather than
        // account data.
        ($this->forgetDiagnosticLog)();

        if ($wasActive) {
            $next = Account::query()->first();

            if ($next instanceof Account) {
                $this->accounts->activate($request, $next);
            }
        }

        return ($this->listAccounts)();
    }
}
