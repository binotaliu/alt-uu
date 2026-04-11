<?php

declare(strict_types=1);

namespace AltUU\Domains\Auth\Actions;

use App\Services\UUAuthClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final readonly class Logout
{
    public function __construct(
        private UUAuthClient $authClient,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $this->authClient->logout($request);

        DB::table('cache')->delete();

        return response()->json(['ok' => true]);
    }
}
