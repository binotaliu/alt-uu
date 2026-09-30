<?php

declare(strict_types=1);

namespace AltUU\Domains\Account\Actions;

use AltUU\Domains\Account\Actions\Results\AccountSessionResult;
use AltUU\Domains\Account\DataTransferObjects\ReauthenticateAccountInputData;
use AltUU\Domains\Auth\Support\LoginFailureMessage;
use App\Models\Account;
use App\Services\AccountManager;

final readonly class ReauthenticateAccount
{
    public function __construct(
        private AccountManager $accounts,
        private ListAccounts $listAccounts,
    ) {}

    public function __invoke(Account $account, ReauthenticateAccountInputData $input): AccountSessionResult
    {
        $result = $this->accounts->attemptLogin($account->username, $input->password);

        if (! $result['ok']) {
            return new AccountSessionResult(
                ok: false,
                message: LoginFailureMessage::localize($result['message']),
                raw: $result['raw'] ?? null,
            );
        }

        return new AccountSessionResult(ok: true, accounts: ($this->listAccounts)());
    }
}
