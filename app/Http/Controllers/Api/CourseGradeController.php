<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\ListCourses;
use AltUU\Domains\SchoolPortal\Actions\GetCourseSemesterGrade;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalGradeViewModel;
use Illuminate\Http\Request;
use Throwable;

final class CourseGradeController
{
    /**
     * @return array{grade: SchoolPortalGradeViewModel|null}
     */
    public function __invoke(
        Request $request,
        string $cid,
        ListCourses $listCourses,
        GetCourseSemesterGrade $getCourseSemesterGrade,
    ): array {
        $course = collect($listCourses($request)->items())
            ->first(static fn (mixed $item): bool => $item->courseId === $cid);

        if ($course === null) {
            return ['grade' => null];
        }

        try {
            return ['grade' => $getCourseSemesterGrade($request, $course)];
        } catch (Throwable) {
            return ['grade' => null];
        }
    }
}
