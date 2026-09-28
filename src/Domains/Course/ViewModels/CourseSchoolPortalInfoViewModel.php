<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\ViewModels;

use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalClassSessionInfoViewModel;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalExamInfoViewModel;
use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class CourseSchoolPortalInfoViewModel extends Resource
{
    public function __construct(
        public ?SchoolPortalClassSessionInfoViewModel $classSessionInfo = null,
        public ?SchoolPortalExamInfoViewModel $examInfo = null,
    ) {}
}
