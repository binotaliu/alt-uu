<?php

declare(strict_types=1);

namespace AltUU\Domains\SchoolPortal\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class SchoolPortalClassSessionInfoViewModel extends Resource
{
    public function __construct(
        public string $courseName,
        public string $semesterLabel,
        public ?string $classDates = null,
        public ?string $classType = null,
        public ?string $classCode = null,
        public ?string $teacher = null,
        public ?string $classTime = null,
    ) {}
}
