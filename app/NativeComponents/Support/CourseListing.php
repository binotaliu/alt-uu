<?php

declare(strict_types=1);

namespace App\NativeComponents\Support;

use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use AltUU\Domains\Course\ViewModels\CourseTasksCountViewModel;

/**
 * Pure helpers for the course list screen: semester grouping and the merged
 * task counters shown on each card (port of CourseListTab.vue).
 */
final class CourseListing
{
    public const string UNGROUPED_SEMESTER = '其他';

    /**
     * Group courses by trimmed semester, preserving first-seen order.
     *
     * @param  iterable<CourseItemViewModel>  $courses
     * @return array<string, list<CourseItemViewModel>>
     */
    public static function groupBySemester(iterable $courses): array
    {
        $groups = [];

        foreach ($courses as $course) {
            $key = $course->semester !== null && trim($course->semester) !== ''
                ? trim($course->semester)
                : self::UNGROUPED_SEMESTER;

            $groups[$key][] = $course;
        }

        return $groups;
    }

    /**
     * Task counters of a course plus those of its common (shared) course.
     *
     * @param  array<string, CourseTasksCountViewModel|array<string, int|string>>  $tasksCount  keyed by course id
     * @return array{pendingHomeworks: int, unreadArticles: int}
     */
    public static function tasksFor(CourseItemViewModel $course, array $tasksCount): array
    {
        $ids = array_filter([$course->courseId, $course->commonCourseId]);
        $pending = 0;
        $unread = 0;

        foreach ($ids as $id) {
            $entry = $tasksCount[$id] ?? null;

            if ($entry instanceof CourseTasksCountViewModel) {
                $pending += $entry->pendingHomeworks;
                $unread += $entry->unreadArticles;
            } elseif (is_array($entry)) {
                $pending += (int) ($entry['pendingHomeworks'] ?? 0);
                $unread += (int) ($entry['unreadArticles'] ?? 0);
            }
        }

        return ['pendingHomeworks' => $pending, 'unreadArticles' => $unread];
    }
}
