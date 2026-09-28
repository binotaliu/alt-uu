<?php

declare(strict_types=1);

namespace AltUU\Domains\Account\Actions;

use AltUU\Domains\Account\DataTransferObjects\AddAccountInputData;
use AltUU\Domains\Account\Exceptions\AccountLimitExceededException;
use App\Services\AccountManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final readonly class AddAccount
{
    private const MAX_ACCOUNTS = 5;

    public function __construct(
        private AccountManager $accounts,
        private ListAccounts $listAccounts,
    ) {}

    public function __invoke(Request $request, AddAccountInputData $input): JsonResponse
    {
        if ($this->accounts->count() >= self::MAX_ACCOUNTS) {
            throw new AccountLimitExceededException;
        }

        $result = $this->accounts->attemptLogin($request, $input->username, $input->password);

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
