<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\GetCourseLearningTimeItems;
use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use AltUU\Domains\Course\ViewModels\CourseLearningTimeItemViewModel;
use Illuminate\Http\Request;
use Spatie\LaravelData\DataCollection;

final class CourseLearningTimesController
{
    /**
     * @return DataCollection<CourseLearningTimeItemViewModel>
     */
    public function __invoke(
        Request $request,
        string $cid,
        GetCourseLearningTimeItems $getLearningTimes,
        SyncCurrentCourse $syncCourse,
    ): DataCollection {
        $syncCourse($request, $cid);

        return $getLearningTimes($request, $cid);
    }
}
