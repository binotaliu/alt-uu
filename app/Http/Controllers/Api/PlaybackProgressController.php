<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Models\PlaybackProgress;
use App\Services\AccountActiveProfile;

final class PlaybackProgressController
{
    public function __construct(private readonly AccountActiveProfile $activeProfile) {}

    /**
     * @return array{progress: array<string, mixed>|null}
     */
    public function show(string $cid, string $activityId): array
    {
        $progress = PlaybackProgress::where('account_id', $this->activeProfile->get())
            ->where('cid', $cid)
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
                'mediaDurationSeconds' => $progress->media_duration_seconds,
                'hunguUploadSuccess' => $progress->hungu_upload_success,
                'updatedAt' => $progress->updated_at?->toIso8601String(),
            ],
        ];
    }
}
