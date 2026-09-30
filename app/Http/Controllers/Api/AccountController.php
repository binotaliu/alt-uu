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

final class AccountController
{
    public function store(AddAccountInputData $input, AddAccount $addAccount): JsonResponse
    {
        $result = $addAccount($input);

        if (! $result->ok) {
            return response()->json([
                'ok' => false,
                'message' => $result->message,
                ...($result->raw !== null ? ['raw' => $result->raw] : []),
            ], 422);
        }

        return response()->json([
            'ok' => true,
            'message' => '',
            'accounts' => $result->accounts,
        ]);
    }

    /**
     * @return array<int, AccountViewModel>
     */
    public function destroy(Account $account, RemoveAccount $removeAccount): array
    {
        return $removeAccount($account);
    }

    /**
     * @return array<int, AccountViewModel>
     */
    public function update(Account $account, RenameAccountInputData $input, RenameAccount $renameAccount): array
    {
        return $renameAccount($account, $input->nickname);
    }
}
