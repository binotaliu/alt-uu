<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use AltUU\Domains\Auth\Actions\Login;
use AltUU\Domains\Auth\Actions\Logout;
use AltUU\Domains\Auth\DataTransferObjects\LoginInputData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AuthController
{
    public function store(Request $request, LoginInputData $input, Login $login): JsonResponse
    {
        return $login($request, $input);
    }

    public function destroy(Request $request, Logout $logout): JsonResponse
    {
        return $logout($request);
    }
}
