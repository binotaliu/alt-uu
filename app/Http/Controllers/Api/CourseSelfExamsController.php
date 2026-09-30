<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\GetCourseSelfExams;
use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use AltUU\Domains\Course\ViewModels\CourseHomeworkItemViewModel;
use Spatie\LaravelData\DataCollection;

final class CourseSelfExamsController
{
    /**
     * @return DataCollection<CourseHomeworkItemViewModel>
     */
    public function __invoke(
        string $cid,
        GetCourseSelfExams $getSelfExams,
        SyncCurrentCourse $syncCourse,
    ): DataCollection {
        $syncCourse($cid, force: true);

        return $getSelfExams();
    }
}
