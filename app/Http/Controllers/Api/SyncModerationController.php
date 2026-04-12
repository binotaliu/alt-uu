<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Moderation\Actions\SyncBlockedContents;
use Illuminate\Http\JsonResponse;

final class SyncModerationController
{
    public function __invoke(SyncBlockedContents $sync): JsonResponse
    {
        $sync();

        return response()->json(['ok' => true]);
    }
}
