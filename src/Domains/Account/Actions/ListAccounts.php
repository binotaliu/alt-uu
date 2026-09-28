<?php

declare(strict_types=1);

namespace AltUU\Domains\Account\Actions;

use AltUU\Domains\Account\ViewModels\AccountViewModel;
use App\Models\Account;
use App\Services\AccountManager;

final readonly class ListAccounts
{
    public function __construct(private AccountManager $accounts) {}

    /**
     * @return array<int, AccountViewModel>
     */
    public function __invoke(): array
    {
        $activeId = $this->accounts->activeId();

        return $this->accounts->all()
            ->map(fn (Account $account): AccountViewModel => AccountViewModel::fromAccount(
                $account,
                $account->id === $activeId,
            ))
            ->values()
            ->all();
    }
}
