<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Models\PlaybackProgress;
use App\Services\AccountActiveProfile;

final class CourseLastSeenMaterialController
{
    public function __construct(private readonly AccountActiveProfile $activeProfile) {}

    /**
     * @return array{activityId: string|null, positionSeconds: float|null, mediaDurationSeconds: float|null}
     */
    public function __invoke(string $cid): array
    {
        $progress = PlaybackProgress::query()
            ->where('account_id', $this->activeProfile->get())
            ->where('cid', $cid)
            ->orderByDesc('updated_at')
            ->first();

        return [
            'activityId' => $progress?->activity_id,
            'positionSeconds' => $progress?->position_seconds,
            'mediaDurationSeconds' => $progress?->media_duration_seconds,
        ];
    }
}
