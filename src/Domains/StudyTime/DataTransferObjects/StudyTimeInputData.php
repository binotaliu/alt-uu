<?php

declare(strict_types=1);

namespace AltUU\Domains\StudyTime\DataTransferObjects;

use DateTimeInterface;
use Spatie\LaravelData\Attributes\Validation\Date;
use Spatie\LaravelData\Attributes\Validation\IntegerType;
use Spatie\LaravelData\Attributes\Validation\Max;
use Spatie\LaravelData\Attributes\Validation\Min;
use Spatie\LaravelData\Attributes\Validation\Nullable;
use Spatie\LaravelData\Attributes\Validation\Required;
use Spatie\LaravelData\Attributes\Validation\Url;
use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class StudyTimeInputData extends Data
{
    public function __construct(
        #[Required, Max(64)]
        public string $cid,
        #[Required, Max(191)]
        public string $activityId,
        #[Required, Url, Max(2000)]
        public string $url,
        #[Nullable, IntegerType, Min(1), Max(28800)]
        public ?int $seconds = null,
        #[Nullable, Date]
        public ?DateTimeInterface $startedAt = null,
    ) {}
}
