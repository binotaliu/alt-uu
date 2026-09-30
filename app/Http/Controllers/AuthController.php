<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use AltUU\Domains\Auth\Actions\Login;
use AltUU\Domains\Auth\Actions\Logout;
use AltUU\Domains\Auth\DataTransferObjects\LoginInputData;
use Illuminate\Http\JsonResponse;

final class AuthController
{
    public function store(LoginInputData $input, Login $login): JsonResponse
    {
        $result = $login($input);

        if (! $result->ok) {
            return response()->json([
                'ok' => false,
                'message' => $result->message,
                'raw' => $result->raw,
            ], 422);
        }

        return response()->json(['ok' => true]);
    }

    public function destroy(Logout $logout): JsonResponse
    {
        $logout();

        return response()->json(['ok' => true]);
    }
}
