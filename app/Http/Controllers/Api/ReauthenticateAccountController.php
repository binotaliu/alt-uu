<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Account\Actions\ReauthenticateAccount;
use AltUU\Domains\Account\DataTransferObjects\ReauthenticateAccountInputData;
use App\Models\Account;
use Illuminate\Http\JsonResponse;

final class ReauthenticateAccountController
{
    public function __invoke(
        int $account,
        ReauthenticateAccountInputData $input,
        ReauthenticateAccount $reauthenticateAccount,
    ): JsonResponse {
        // withTrashed(): a session that fails its remembered re-login is
        // soft-deleted by AccountCredentialsStore::forget() before the
        // client ever gets a chance to offer this re-login screen for it.
        $accountModel = Account::withTrashed()->findOrFail($account);

        $result = $reauthenticateAccount($accountModel, $input);

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
}
