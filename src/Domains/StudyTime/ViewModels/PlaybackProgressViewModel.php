<?php

declare(strict_types=1);

namespace AltUU\Domains\StudyTime\ViewModels;

use App\Models\PlaybackProgress;
use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class PlaybackProgressViewModel extends Resource
{
    public function __construct(
        public string $cid,
        public string $activityId,
        public int $studySeconds,
        public float $positionSeconds,
        public ?float $mediaDurationSeconds,
        public ?bool $hunguUploadSuccess,
        public ?string $updatedAt,
    ) {}

    public static function fromModel(PlaybackProgress $progress): self
    {
        return new self(
            cid: $progress->cid,
            activityId: $progress->activity_id,
            studySeconds: $progress->duration_seconds,
            positionSeconds: $progress->position_seconds,
            mediaDurationSeconds: $progress->media_duration_seconds,
            hunguUploadSuccess: $progress->hungu_upload_success,
            updatedAt: $progress->updated_at?->toIso8601String(),
        );
    }
}
