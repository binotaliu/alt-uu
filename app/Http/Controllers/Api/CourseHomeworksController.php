<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\GetCourseHomeworks;
use AltUU\Domains\Course\Actions\ListCourses;
use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use AltUU\Domains\Course\ViewModels\CourseHomeworkListViewModel;
use AltUU\Domains\SchoolPortal\Actions\GetSchoolPortalHomeworkNotices;
use Throwable;

final class CourseHomeworksController
{
    public function __invoke(
        string $cid,
        GetCourseHomeworks $getHomeworks,
        SyncCurrentCourse $syncCourse,
        ListCourses $listCourses,
        GetSchoolPortalHomeworkNotices $getSchoolPortalHomeworkNotices,
    ): CourseHomeworkListViewModel {
        $syncCourse($cid, force: true);

        $homeworkItems = $getHomeworks()->items();

        $course = collect($listCourses()->items())
            ->first(static fn (mixed $item): bool => $item->courseId === $cid);

        $schoolPortalNotices = [];

        if ($course !== null) {
            try {
                $schoolPortalNotices = $getSchoolPortalHomeworkNotices($course)->items();
            } catch (Throwable) {
                // The school portal is a best-effort secondary source; Hongu's own
                // homework listing above still returns normally on failure.
            }
        }

        return new CourseHomeworkListViewModel(
            homeworkItems: $homeworkItems,
            schoolPortalNotices: $schoolPortalNotices,
        );
    }
}
