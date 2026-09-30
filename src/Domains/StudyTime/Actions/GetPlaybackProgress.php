<?php

declare(strict_types=1);

namespace AltUU\Domains\StudyTime\Actions;

use AltUU\Domains\StudyTime\ViewModels\PlaybackProgressViewModel;
use App\Models\PlaybackProgress;
use App\Services\UUStudyTimeClient;

final readonly class GetPlaybackProgress
{
    public function __construct(private UUStudyTimeClient $studyTimeClient) {}

    /**
     * Playback progress of one activity for the given account (defaults to the active one).
     */
    public function __invoke(string $cid, string $activityId, ?int $accountId = null): ?PlaybackProgressViewModel
    {
        $progress = PlaybackProgress::query()
            ->where('account_id', $accountId ?? $this->studyTimeClient->currentAccountId())
            ->where('cid', $cid)
            ->where('activity_id', $activityId)
            ->first();

        return $progress instanceof PlaybackProgress
            ? PlaybackProgressViewModel::fromModel($progress)
            : null;
    }
}
