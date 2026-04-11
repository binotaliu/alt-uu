<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Models\PlaybackProgress;

final class PlaybackProgressController
{
    /**
     * @return array{progress: array<string, mixed>|null}
     */
    public function show(string $cid, string $activityId): array
    {
        $progress = PlaybackProgress::where('cid', $cid)
            ->where('activity_id', $activityId)
            ->first();

        if (! $progress) {
            return ['progress' => null];
        }

        return [
            'progress' => [
                'cid' => $progress->cid,
                'activityId' => $progress->activity_id,
                'studySeconds' => $progress->duration_seconds,
                'positionSeconds' => $progress->position_seconds,
                'hunguUploadSuccess' => $progress->hungu_upload_success,
                'updatedAt' => $progress->updated_at?->toIso8601String(),
            ],
        ];
    }
}
