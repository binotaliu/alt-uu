<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\ListCourses;
use AltUU\Domains\Course\ViewModels\CourseSchoolPortalInfoViewModel;
use AltUU\Domains\SchoolPortal\Actions\GetCourseClassSessionInfo;
use AltUU\Domains\SchoolPortal\Actions\GetCourseExamInfo;
use Illuminate\Http\Request;
use Throwable;

final class CourseSchoolPortalInfoController
{
    public function __invoke(
        Request $request,
        string $cid,
        ListCourses $listCourses,
        GetCourseClassSessionInfo $getClassSessionInfo,
        GetCourseExamInfo $getExamInfo,
    ): CourseSchoolPortalInfoViewModel {
        $course = collect($listCourses($request)->items())
            ->first(static fn (mixed $item): bool => $item->courseId === $cid);

        if ($course === null) {
            return new CourseSchoolPortalInfoViewModel;
        }

        try {
            $classSessionInfo = $getClassSessionInfo($request, $course);
        } catch (Throwable) {
            $classSessionInfo = null;
        }

        try {
            $examInfo = $getExamInfo($request, $course);
        } catch (Throwable) {
            $examInfo = null;
        }

        return new CourseSchoolPortalInfoViewModel(
            classSessionInfo: $classSessionInfo,
            examInfo: $examInfo,
        );
    }
}
