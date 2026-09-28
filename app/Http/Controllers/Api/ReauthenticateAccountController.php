<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Account\Actions\ReauthenticateAccount;
use AltUU\Domains\Account\DataTransferObjects\ReauthenticateAccountInputData;
use App\Models\Account;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ReauthenticateAccountController
{
    public function __invoke(
        Request $request,
        int $account,
        ReauthenticateAccountInputData $input,
        ReauthenticateAccount $reauthenticateAccount,
    ): JsonResponse {
        // withTrashed(): a session that fails its remembered re-login is
        // soft-deleted by AccountCredentialsStore::forget() before the
        // client ever gets a chance to offer this re-login screen for it.
        $accountModel = Account::withTrashed()->findOrFail($account);

        return $reauthenticateAccount($request, $accountModel, $input);
    }
}
