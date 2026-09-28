<?php

declare(strict_types=1);

namespace AltUU\Domains\Account\Actions;

use AltUU\Domains\Account\DataTransferObjects\ReauthenticateAccountInputData;
use App\Models\Account;
use App\Services\AccountManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final readonly class ReauthenticateAccount
{
    public function __construct(
        private AccountManager $accounts,
        private ListAccounts $listAccounts,
    ) {}

    public function __invoke(Request $request, Account $account, ReauthenticateAccountInputData $input): JsonResponse
    {
        $result = $this->accounts->attemptLogin($request, $account->username, $input->password);

        if (! $result['ok']) {
            return response()->json($result, 422);
        }

        return response()->json([
            'ok' => true,
            'message' => '',
            'accounts' => ($this->listAccounts)(),
        ]);
    }
}
