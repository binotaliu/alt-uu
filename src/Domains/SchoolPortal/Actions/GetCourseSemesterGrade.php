<?php

declare(strict_types=1);

namespace AltUU\Domains\SchoolPortal\Actions;

use AltUU\Domains\Course\Support\CourseNameMatcher;
use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use AltUU\Domains\SchoolPortal\Support\SchoolPortalGradeRepository;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalGradeViewModel;
use Illuminate\Http\Request;

final readonly class GetCourseSemesterGrade
{
    public function __construct(private SchoolPortalGradeRepository $gradeRepository) {}

    public function __invoke(Request $request, CourseItemViewModel $course): ?SchoolPortalGradeViewModel
    {
        $targetName = CourseNameMatcher::normalizeName($course->name);
        $targetTerm = CourseNameMatcher::normalizeTermCode($course->semester);

        if ($targetName === '' || $targetTerm === null) {
            return null;
        }

        foreach ($this->gradeRepository->currentSemesterGrades($request) as $grade) {
            if ($grade['termCode'] === $targetTerm && $grade['normalizedCourseName'] === $targetName) {
                return SchoolPortalGradeRepository::toViewModel($grade);
            }
        }

        // The "current semester" page (qryscore) only ever renders the
        // portal's idea of the current semester, so a past semester's course
        // is never found there — fall back to the historical grades page
        // (qryscore2), which lists every semester but with a coarser field
        // set (final grade + credits only, no per-component breakdown).
        foreach ($this->gradeRepository->historicalGrades($request) as $grade) {
            if ($grade['termCode'] === $targetTerm && $grade['normalizedCourseName'] === $targetName) {
                return SchoolPortalGradeRepository::toViewModel($grade);
            }
        }

        return null;
    }
}
