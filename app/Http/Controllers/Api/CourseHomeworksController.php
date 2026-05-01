<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\GetCourseHomeworks;
use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use AltUU\Domains\Course\ViewModels\CourseHomeworkItemViewModel;
use Illuminate\Http\Request;
use Spatie\LaravelData\DataCollection;

final class CourseHomeworksController
{
    /**
     * @return DataCollection<CourseHomeworkItemViewModel>
     */
    public function __invoke(
        Request $request,
        string $cid,
        GetCourseHomeworks $getHomeworks,
        SyncCurrentCourse $syncCourse,
    ): DataCollection {
        $syncCourse($request, $cid, force: true);

        return $getHomeworks($request);
    }
}
