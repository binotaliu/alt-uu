<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Account\Actions\SwitchAccount;
use App\Models\Account;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SwitchAccountController
{
    public function __invoke(Request $request, Account $account, SwitchAccount $switchAccount): JsonResponse
    {
        return $switchAccount($request, $account);
    }
}
