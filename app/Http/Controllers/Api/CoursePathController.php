<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\GetCoursePathInfo;
use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use AltUU\Domains\Course\ViewModels\CourseMaterialNodeViewModel;
use AltUU\Domains\Course\ViewModels\CoursePathInfoViewModel;
use Illuminate\Http\Request;
use Spatie\LaravelData\DataCollection;

final class CoursePathController
{
    /**
     * @return array{pathInfo: CoursePathInfoViewModel, materialNodes: DataCollection<CourseMaterialNodeViewModel>}
     */
    public function __invoke(
        Request $request,
        string $cid,
        GetCoursePathInfo $getPath,
        SyncCurrentCourse $syncCourse,
    ): array {
        $syncCourse($request, $cid);

        return $getPath($request, $cid);
    }
}
