<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\StudyTime\Actions\GetPlaybackProgress;
use AltUU\Domains\StudyTime\ViewModels\PlaybackProgressViewModel;

final class PlaybackProgressController
{
    /**
     * @return array{progress: PlaybackProgressViewModel|null}
     */
    public function show(string $cid, string $activityId, GetPlaybackProgress $getPlaybackProgress): array
    {
        return ['progress' => $getPlaybackProgress($cid, $activityId)];
    }
}
