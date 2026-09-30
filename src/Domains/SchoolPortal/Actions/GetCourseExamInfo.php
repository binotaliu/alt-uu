<?php

declare(strict_types=1);

namespace AltUU\Domains\SchoolPortal\Actions;

use AltUU\Domains\Course\Support\CourseNameMatcher;
use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use AltUU\Domains\SchoolPortal\Support\SchoolPortalExamInfoRepository;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalExamInfoViewModel;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalExamScheduleViewModel;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalExamScopeViewModel;

final readonly class GetCourseExamInfo
{
    public function __construct(private SchoolPortalExamInfoRepository $examInfoRepository) {}

    public function __invoke(CourseItemViewModel $course): ?SchoolPortalExamInfoViewModel
    {
        $targetName = CourseNameMatcher::normalizeName($course->name);
        $targetTerm = CourseNameMatcher::normalizeTermCode($course->semester);

        if ($targetName === '' || $targetTerm === null) {
            return null;
        }

        $page = $this->examInfoRepository->currentSemesterExamInfo();

        if ($page['termCode'] !== $targetTerm || ! isset($page['courses'][$targetName])) {
            return null;
        }

        $matched = $page['courses'][$targetName];

        return new SchoolPortalExamInfoViewModel(
            courseName: $matched['courseName'],
            semesterLabel: $page['semesterLabel'],
            schedules: array_map(
                static fn (array $schedule): SchoolPortalExamScheduleViewModel => new SchoolPortalExamScheduleViewModel(
                    category: $schedule['category'],
                    date: $schedule['date'],
                    time: $schedule['time'],
                    room: $schedule['room'],
                    note: $schedule['note'],
                ),
                $matched['schedules'],
            ),
            scopes: array_map(
                static fn (array $scope): SchoolPortalExamScopeViewModel => new SchoolPortalExamScopeViewModel(
                    category: $scope['category'],
                    scope: $scope['scope'],
                ),
                $matched['scopes'],
            ),
        );
    }
}
