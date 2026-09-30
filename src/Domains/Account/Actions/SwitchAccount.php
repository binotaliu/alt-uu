<?php

declare(strict_types=1);

namespace AltUU\Domains\Account\Actions;

use AltUU\Domains\Account\Actions\Results\AccountSessionResult;
use App\Models\Account;
use App\Services\AccountManager;

final readonly class SwitchAccount
{
    public function __construct(
        private AccountManager $accounts,
        private ListAccounts $listAccounts,
    ) {}

    public function __invoke(Account $account): AccountSessionResult
    {
        $activated = $this->accounts->activate($account);

        return new AccountSessionResult(
            ok: $activated,
            message: $activated ? '' : '此帳號的登入已失效，請重新輸入密碼。',
            accounts: ($this->listAccounts)(),
        );
    }
}
