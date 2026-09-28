<?php

declare(strict_types=1);

namespace AltUU\Domains\DataPortability\ViewModels;

use App\Models\PlaybackProgress;
use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class PlaybackProgressExportItemViewModel extends Resource
{
    public function __construct(
        public string $username,
        public string $cid,
        public string $activityId,
        public int $durationSeconds,
        public float $positionSeconds,
        public ?bool $hunguUploadSuccess,
    ) {}

    public static function fromModel(PlaybackProgress $playbackProgress, string $username): self
    {
        return new self(
            username: $username,
            cid: $playbackProgress->cid,
            activityId: $playbackProgress->activity_id,
            durationSeconds: $playbackProgress->duration_seconds,
            positionSeconds: $playbackProgress->position_seconds,
            hunguUploadSuccess: $playbackProgress->hungu_upload_success,
        );
    }
}
