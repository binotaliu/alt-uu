<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Moderation\Actions\BlockUser;
use AltUU\Domains\Moderation\Actions\UnblockUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class BlockUserModerationController
{
    public function store(Request $request, BlockUser $block): JsonResponse
    {
        $validated = $request->validate([
            'poster' => ['required', 'string'],
            'realname' => ['required', 'string'],
        ]);

        $block(
            poster: $validated['poster'],
            realname: $validated['realname'],
        );

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request, UnblockUser $unblock): JsonResponse
    {
        $validated = $request->validate([
            'poster' => ['required', 'string'],
            'realname' => ['required', 'string'],
        ]);

        $unblock(
            poster: $validated['poster'],
            realname: $validated['realname'],
        );

        return response()->json(['ok' => true]);
    }
}
