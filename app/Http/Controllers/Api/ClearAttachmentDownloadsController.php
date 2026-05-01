<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\AttachmentDownload\Actions\CleanupAttachmentDownloads;
use Illuminate\Http\JsonResponse;

final class ClearAttachmentDownloadsController
{
    public function __invoke(CleanupAttachmentDownloads $cleanupAttachmentDownloads): JsonResponse
    {
        $result = $cleanupAttachmentDownloads();

        return response()->json([
            'ok' => true,
            'clearedTasks' => $result['clearedTasks'],
            'deletedFiles' => $result['deletedFiles'],
        ]);
    }
}
