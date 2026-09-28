<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Account\Actions\AddAccount;
use AltUU\Domains\Account\Actions\RemoveAccount;
use AltUU\Domains\Account\Actions\RenameAccount;
use AltUU\Domains\Account\DataTransferObjects\AddAccountInputData;
use AltUU\Domains\Account\DataTransferObjects\RenameAccountInputData;
use AltUU\Domains\Account\ViewModels\AccountViewModel;
use App\Models\Account;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AccountController
{
    public function store(Request $request, AddAccountInputData $input, AddAccount $addAccount): JsonResponse
    {
        return $addAccount($request, $input);
    }

    /**
     * @return array<int, AccountViewModel>
     */
    public function destroy(Request $request, Account $account, RemoveAccount $removeAccount): array
    {
        return $removeAccount($request, $account);
    }

    /**
     * @return array<int, AccountViewModel>
     */
    public function update(Account $account, RenameAccountInputData $input, RenameAccount $renameAccount): array
    {
        return $renameAccount($account, $input->nickname);
    }
}
