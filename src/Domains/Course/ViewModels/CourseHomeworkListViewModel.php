<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\ViewModels;

use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalHomeworkNoticeViewModel;
use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class CourseHomeworkListViewModel extends Resource
{
    /**
     * @param  CourseHomeworkItemViewModel[]  $homeworkItems
     * @param  SchoolPortalHomeworkNoticeViewModel[]  $schoolPortalNotices
     */
    public function __construct(
        public array $homeworkItems,
        public array $schoolPortalNotices,
    ) {}
}
