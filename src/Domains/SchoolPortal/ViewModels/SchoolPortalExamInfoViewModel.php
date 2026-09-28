<?php

declare(strict_types=1);

namespace AltUU\Domains\SchoolPortal\ViewModels;

use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class SchoolPortalExamInfoViewModel extends Resource
{
    /**
     * @param  SchoolPortalExamScheduleViewModel[]  $schedules
     * @param  SchoolPortalExamScopeViewModel[]  $scopes
     */
    public function __construct(
        public string $courseName,
        public string $semesterLabel,
        public array $schedules,
        public array $scopes,
    ) {}
}
