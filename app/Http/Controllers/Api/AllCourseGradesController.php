<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\SchoolPortal\Actions\GetAllCourseGrades;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalGradeViewModel;

final class AllCourseGradesController
{
    /**
     * @return array{grades: array<int, SchoolPortalGradeViewModel>}
     */
    public function __invoke(GetAllCourseGrades $getAllCourseGrades): array
    {
        return ['grades' => $getAllCourseGrades()];
    }
}
