<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Account\Actions\SwitchAccount;
use App\Models\Account;
use Illuminate\Http\JsonResponse;

final class SwitchAccountController
{
    public function __invoke(Account $account, SwitchAccount $switchAccount): JsonResponse
    {
        $result = $switchAccount($account);

        return response()->json([
            'ok' => $result->ok,
            'message' => $result->message,
            'accounts' => $result->accounts,
        ], $result->ok ? 200 : 422);
    }
}
