<?php

declare(strict_types=1);

namespace AltUU\Domains\Account\Actions;

use AltUU\Domains\Account\ViewModels\AccountViewModel;
use App\Models\Account;

final readonly class RenameAccount
{
    public function __construct(private ListAccounts $listAccounts) {}

    /**
     * @return array<int, AccountViewModel>
     */
    public function __invoke(Account $account, ?string $nickname): array
    {
        $nickname = $nickname !== null ? trim($nickname) : null;

        $account->update(['nickname' => $nickname === '' ? null : $nickname]);

        return ($this->listAccounts)();
    }
}
