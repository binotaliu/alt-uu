<?php

declare(strict_types=1);

namespace AltUU\Domains\StudyTime\Actions;

use AltUU\Domains\StudyTime\ViewModels\LastSeenMaterialViewModel;
use App\Models\PlaybackProgress;
use App\Services\UUStudyTimeClient;

final readonly class GetLastSeenMaterial
{
    public function __construct(private UUStudyTimeClient $studyTimeClient) {}

    /**
     * Most recently updated activity of a course for the given account (defaults to the active one).
     * All fields are null when nothing has been played yet.
     */
    public function __invoke(string $cid, ?int $accountId = null): LastSeenMaterialViewModel
    {
        $progress = PlaybackProgress::query()
            ->where('account_id', $accountId ?? $this->studyTimeClient->currentAccountId())
            ->where('cid', $cid)
            ->orderByDesc('updated_at')
            ->first();

        return new LastSeenMaterialViewModel(
            activityId: $progress?->activity_id,
            positionSeconds: $progress?->position_seconds,
            mediaDurationSeconds: $progress?->media_duration_seconds,
        );
    }
}
