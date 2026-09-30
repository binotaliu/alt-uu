<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\GetCoursePathInfo;
use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use AltUU\Domains\Course\ViewModels\CourseMaterialNodeViewModel;
use AltUU\Domains\Course\ViewModels\CoursePathInfoViewModel;
use Spatie\LaravelData\DataCollection;

final class CoursePathController
{
    /**
     * @return array{pathInfo: CoursePathInfoViewModel, materialNodes: DataCollection<CourseMaterialNodeViewModel>}
     */
    public function __invoke(
        string $cid,
        GetCoursePathInfo $getPath,
        SyncCurrentCourse $syncCourse,
    ): array {
        $syncCourse($cid);

        return $getPath($cid);
    }
}
