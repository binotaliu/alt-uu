<?php

declare(strict_types=1);

namespace AltUU\Domains\Account\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

final class AccountLimitExceededException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('最多只能新增 5 個帳號。');
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json(['ok' => false, 'message' => $this->getMessage()], 422);
    }
}
