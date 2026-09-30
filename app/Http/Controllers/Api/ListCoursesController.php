<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\ListCourses;
use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use Spatie\LaravelData\DataCollection;

final class ListCoursesController
{
    /**
     * @return DataCollection<CourseItemViewModel>
     */
    public function __invoke(ListCourses $list): DataCollection
    {
        return $list();
    }
}
