<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Account\Actions\ListAccounts;
use AltUU\Domains\Account\ViewModels\AccountViewModel;

final class ListAccountsController
{
    /**
     * @return array<int, AccountViewModel>
     */
    public function __invoke(ListAccounts $listAccounts): array
    {
        return $listAccounts();
    }
}
