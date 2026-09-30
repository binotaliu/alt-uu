<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * One course row of the course list (CourseListTab.vue).
 *
 * Tag: `<native:course-card key="course-{{ $c->courseId }}" :course="$c" :pending-homeworks="$n" :unread-articles="$m" :tasks-loading="$loading" :tasks-error="$failed" />`
 *
 * Props: `course` (CourseItemViewModel), `pendingHomeworks`, `unreadArticles`
 * (ints, already merged with the common course, see CourseListing::tasksFor),
 * `tasksLoading` (bool, shows a placeholder instead of the counters),
 * `tasksError` (bool, shows 取得待辦失敗).
 * Events: `selected` (course id) fired right before navigating. Tapping
 * navigates to `native.courses.show` itself.
 */
final class CourseCard extends NativeComponent
{
    public ?CourseItemViewModel $course = null;

    public int $pendingHomeworks = 0;

    public int $unreadArticles = 0;

    public bool $tasksLoading = false;

    public bool $tasksError = false;

    public function open(): void
    {
        if ($this->course === null) {
            return;
        }

        $this->emit('selected', $this->course->courseId);
        $this->navigate($this->route('native.courses.show', ['cid' => $this->course->courseId]));
    }

    public function render(): View
    {
        return view('native.shared.course-card', [
            'unreadLabel' => $this->unreadArticles > 99 ? '99+' : (string) $this->unreadArticles,
        ]);
    }
}
