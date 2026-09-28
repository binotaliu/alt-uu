<?php

declare(strict_types=1);

namespace AltUU\Domains\SchoolPortal\Actions;

use AltUU\Domains\SchoolPortal\Support\SchoolPortalExamInfoRepository;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalExamAgendaItemViewModel;
use Illuminate\Http\Request;

final readonly class GetExamAgenda
{
    /**
     * Only categories containing this marker (e.g. "期中考(正考)",
     * "期末考(正考)") are regular exams — others are makeup/resit exams
     * ("補考"/"重補修考") which this agenda intentionally excludes.
     */
    private const REGULAR_EXAM_MARKER = '正考';

    public function __construct(private SchoolPortalExamInfoRepository $examInfoRepository) {}

    /**
     * @return array<int, SchoolPortalExamAgendaItemViewModel>
     */
    public function __invoke(Request $request): array
    {
        $page = $this->examInfoRepository->currentSemesterExamInfo($request);
        $items = [];

        foreach ($page['courses'] as $course) {
            foreach ($course['schedules'] as $schedule) {
                if (! str_contains($schedule['category'], self::REGULAR_EXAM_MARKER)) {
                    continue;
                }

                // Unified/non-scheduled exams (e.g. "統一命題非集中考試") have no
                // date/time, just a free-form note — an agenda entry with
                // nothing to schedule around isn't useful, so skip it.
                if ($schedule['time'] === null) {
                    continue;
                }

                $items[] = new SchoolPortalExamAgendaItemViewModel(
                    courseName: $course['courseName'],
                    category: $schedule['category'],
                    date: $schedule['date'],
                    time: $schedule['time'],
                    room: $schedule['room'],
                );
            }
        }

        usort($items, fn (SchoolPortalExamAgendaItemViewModel $a, SchoolPortalExamAgendaItemViewModel $b): int => $this->sortKey($a) <=> $this->sortKey($b));

        return $items;
    }

    /**
     * Builds a sortable "YYYYMMDDHHmm" key (as an int, not a numeric string
     * — PHP's `<=>` compares numeric strings numerically, which would put
     * the PHP_INT_MAX sentinel below a merely-large date value) from the
     * free-form date/time strings the portal returns (e.g.
     * "2026年11月07日(星期六)" and "1500~1610第5節"), so entries can be ordered
     * chronologically. Unparseable or missing date/time sorts last, after
     * every scheduled exam.
     */
    private function sortKey(SchoolPortalExamAgendaItemViewModel $item): int
    {
        $date = $item->date;
        $time = $item->time;

        if ($date === null || $time === null) {
            return PHP_INT_MAX;
        }

        if (preg_match('/^(?<year>\d+)年(?<month>\d+)月(?<day>\d+)日/u', $date, $dateMatches) !== 1) {
            return PHP_INT_MAX;
        }

        if (preg_match('/^(?<hour>\d{2})(?<minute>\d{2})/', $time, $timeMatches) !== 1) {
            return PHP_INT_MAX;
        }

        return (int) sprintf(
            '%04d%02d%02d%02d%02d',
            (int) $dateMatches['year'],
            (int) $dateMatches['month'],
            (int) $dateMatches['day'],
            (int) $timeMatches['hour'],
            (int) $timeMatches['minute'],
        );
    }
}
