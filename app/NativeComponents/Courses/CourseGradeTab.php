<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses;

use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalGradeViewModel;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * 成績 tab of CourseShow (CourseGradeTab.vue): regular scores, semester
 * scores and the resulting semester grade from the school portal.
 *
 * Props: `grade` (nullable SchoolPortalGradeViewModel), `loading`, `error`,
 * `errorDetail`. Emits `retry`.
 */
final class CourseGradeTab extends NativeComponent
{
    public ?SchoolPortalGradeViewModel $grade = null;

    public bool $loading = false;

    public string $error = '';

    /** @var array<string, mixed> */
    public array $errorDetail = [];

    public function retry(): void
    {
        $this->emit('retry');
    }

    /**
     * @return list<array{label: string, value: ?string}>
     */
    public function regularScoreItems(): array
    {
        if ($this->grade === null) {
            return [];
        }

        return [
            ['label' => '第一次平時', 'value' => $this->grade->firstRegularScore],
            ['label' => '第二次平時', 'value' => $this->grade->secondRegularScore],
            ['label' => '學習參與', 'value' => $this->grade->participationScore],
        ];
    }

    /**
     * The summer semester has no midterm exam.
     *
     * @return list<array{label: string, value: ?string}>
     */
    public function semesterScoreItems(): array
    {
        if ($this->grade === null) {
            return [];
        }

        $items = [['label' => '平時成績', 'value' => $this->grade->regularAverage]];

        if (! str_contains($this->grade->semesterLabel, '暑')) {
            $items[] = ['label' => '期中成績', 'value' => $this->grade->midtermScore];
        }

        $items[] = ['label' => '期末成績', 'value' => $this->grade->finalScore];

        return $items;
    }

    public function render(): View
    {
        return view('native.courses.course-grade-tab');
    }
}
