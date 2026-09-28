<?php

declare(strict_types=1);

namespace AltUU\Domains\Account\Actions;

use App\Models\Account;
use App\Services\AccountManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final readonly class SwitchAccount
{
    public function __construct(
        private AccountManager $accounts,
        private ListAccounts $listAccounts,
    ) {}

    public function __invoke(Request $request, Account $account): JsonResponse
    {
        $activated = $this->accounts->activate($request, $account);

        return response()->json([
            'ok' => $activated,
            'message' => $activated ? '' : '此帳號的登入已失效，請重新輸入密碼。',
            'accounts' => ($this->listAccounts)(),
        ], $activated ? 200 : 422);
    }
}
