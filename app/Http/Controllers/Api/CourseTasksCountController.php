<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\GetCourseTasksCount;
use AltUU\Domains\Course\ViewModels\CourseTasksCountViewModel;
use Spatie\LaravelData\DataCollection;

final class CourseTasksCountController
{
    /**
     * @return DataCollection<CourseTasksCountViewModel>
     */
    public function __invoke(GetCourseTasksCount $getTasks): DataCollection
    {
        return $getTasks();
    }
}
