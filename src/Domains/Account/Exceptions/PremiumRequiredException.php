<?php

declare(strict_types=1);

namespace AltUU\Domains\Account\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

final class PremiumRequiredException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('此功能需要有效的 Alt UU+ 訂閱。');
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json(['ok' => false, 'message' => $this->getMessage()], 402);
    }
}
