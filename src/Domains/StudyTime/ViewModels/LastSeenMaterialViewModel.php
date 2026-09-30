<?php

declare(strict_types=1);

namespace AltUU\Domains\StudyTime\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class LastSeenMaterialViewModel extends Resource
{
    public function __construct(
        public ?string $activityId,
        public ?float $positionSeconds,
        public ?float $mediaDurationSeconds,
    ) {}
}
