<?php

declare(strict_types=1);

namespace AltUU\Domains\Account\Actions;

use AltUU\Domains\Account\Actions\Results\AccountSessionResult;
use AltUU\Domains\Account\DataTransferObjects\AddAccountInputData;
use AltUU\Domains\Account\Exceptions\AccountLimitExceededException;
use App\Services\AccountManager;

final readonly class AddAccount
{
    private const MAX_ACCOUNTS = 5;

    public function __construct(
        private AccountManager $accounts,
        private ListAccounts $listAccounts,
    ) {}

    public function __invoke(AddAccountInputData $input): AccountSessionResult
    {
        if ($this->accounts->count() >= self::MAX_ACCOUNTS) {
            throw new AccountLimitExceededException;
        }

        $result = $this->accounts->attemptLogin($input->username, $input->password);

        if (! $result['ok']) {
            return new AccountSessionResult(
                ok: false,
                message: $result['message'],
                raw: $result['raw'] ?? null,
            );
        }

        return new AccountSessionResult(ok: true, accounts: ($this->listAccounts)());
    }
}
