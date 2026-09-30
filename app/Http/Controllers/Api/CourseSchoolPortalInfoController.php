<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\ListCourses;
use AltUU\Domains\Course\ViewModels\CourseSchoolPortalInfoViewModel;
use AltUU\Domains\SchoolPortal\Actions\GetCourseClassSessionInfo;
use AltUU\Domains\SchoolPortal\Actions\GetCourseExamInfo;
use Throwable;

final class CourseSchoolPortalInfoController
{
    public function __invoke(
        string $cid,
        ListCourses $listCourses,
        GetCourseClassSessionInfo $getClassSessionInfo,
        GetCourseExamInfo $getExamInfo,
    ): CourseSchoolPortalInfoViewModel {
        $course = collect($listCourses()->items())
            ->first(static fn (mixed $item): bool => $item->courseId === $cid);

        if ($course === null) {
            return new CourseSchoolPortalInfoViewModel;
        }

        try {
            $classSessionInfo = $getClassSessionInfo($course);
        } catch (Throwable) {
            $classSessionInfo = null;
        }

        try {
            $examInfo = $getExamInfo($course);
        } catch (Throwable) {
            $examInfo = null;
        }

        return new CourseSchoolPortalInfoViewModel(
            classSessionInfo: $classSessionInfo,
            examInfo: $examInfo,
        );
    }
}
