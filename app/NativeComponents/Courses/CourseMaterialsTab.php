<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses;

use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * 教材 tab of CourseShow (CourseMaterialsTab.vue): skeleton, error card or
 * the shared material directory in `link` mode (rows navigate to the
 * Material screen themselves).
 *
 * Presentational: the screen owns loading. Emits `retry`.
 */
final class CourseMaterialsTab extends NativeComponent
{
    public string $cid = '';

    /** @var array<int, mixed> */
    public array $learningTimeItems = [];

    public bool $loading = false;

    public string $error = '';

    /** @var array<string, mixed> */
    public array $errorDetail = [];

    public ?string $lastSeenIdentifier = null;

    public ?int $lastSeenPositionSeconds = null;

    public ?int $lastSeenDurationSeconds = null;

    public function retry(): void
    {
        $this->emit('retry');
    }

    public function render(): View
    {
        return view('native.courses.course-materials-tab');
    }
}
