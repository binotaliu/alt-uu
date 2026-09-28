<?php

declare(strict_types=1);

namespace AltUU\Domains\SchoolPortal\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class SchoolPortalGradeViewModel extends Resource
{
    public function __construct(
        public string $courseName,
        public string $semesterLabel,
        public ?string $credits = null,
        public ?string $firstRegularScore = null,
        public ?string $secondRegularScore = null,
        public ?string $participationScore = null,
        public ?string $regularAverage = null,
        public ?string $midtermScore = null,
        public ?string $finalScore = null,
        public ?string $semesterGrade = null,
    ) {}
}
