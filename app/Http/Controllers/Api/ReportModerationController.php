<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Moderation\Actions\ReportContent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ReportModerationController
{
    public function __invoke(Request $request, ReportContent $report): JsonResponse
    {
        $validated = $request->validate([
            'board_id' => ['required', 'string'],
            'node_id' => ['required', 'string'],
            'content' => ['required', 'string'],
            'type' => ['required', 'string', 'in:s,i,c,p,l,m,o'],
        ]);

        $success = $report(
            boardId: $validated['board_id'],
            nodeId: $validated['node_id'],
            content: $validated['content'],
            type: $validated['type'],
        );

        return response()->json(['ok' => $success], $success ? 200 : 502);
    }
}
