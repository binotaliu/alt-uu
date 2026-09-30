<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\GetCourseLearningTimeItems;
use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use AltUU\Domains\Course\ViewModels\CourseLearningTimeItemViewModel;
use Spatie\LaravelData\DataCollection;

final class CourseLearningTimesController
{
    /**
     * @return DataCollection<CourseLearningTimeItemViewModel>
     */
    public function __invoke(
        string $cid,
        GetCourseLearningTimeItems $getLearningTimes,
        SyncCurrentCourse $syncCourse,
    ): DataCollection {
        $syncCourse($cid);

        return $getLearningTimes($cid);
    }
}
