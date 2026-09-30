<?php

declare(strict_types=1);

namespace AltUU\Domains\SchoolPortal\Actions;

use AltUU\Domains\SchoolPortal\Support\SchoolPortalGradeRepository;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalGradeViewModel;

final readonly class GetAllCourseGrades
{
    public function __construct(private SchoolPortalGradeRepository $gradeRepository) {}

    /**
     * @return array<int, SchoolPortalGradeViewModel>
     */
    public function __invoke(): array
    {
        $rows = [];
        $seenKeys = [];

        foreach ($this->gradeRepository->currentSemesterGrades() as $grade) {
            $seenKeys[$grade['termCode'].'|'.$grade['normalizedCourseName']] = true;
            $rows[] = $grade;
        }

        // The historical page (qryscore2) tends to also list the current
        // semester, so skip anything already seen on the current-semester
        // page to avoid showing the same course twice.
        foreach ($this->gradeRepository->historicalGrades() as $grade) {
            $key = $grade['termCode'].'|'.$grade['normalizedCourseName'];

            if (isset($seenKeys[$key])) {
                continue;
            }

            $seenKeys[$key] = true;
            $rows[] = $grade;
        }

        usort($rows, fn (array $a, array $b): int => ($b['termCode'] ?? '') <=> ($a['termCode'] ?? ''));

        return array_map(
            static fn (array $grade): SchoolPortalGradeViewModel => SchoolPortalGradeRepository::toViewModel($grade),
            $rows,
        );
    }
}
