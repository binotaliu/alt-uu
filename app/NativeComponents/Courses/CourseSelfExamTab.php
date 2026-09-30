<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses;

use App\NativeComponents\Courses\Concerns\OpensAttachmentBrowser;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * 自我練習 tab of CourseShow (CourseSelfExamTab.vue).
 *
 * Props: `items` (CourseHomeworkItemViewModel[]), `loading`, `error`,
 * `errorDetail`. Events: `retry`, `browser-opened`.
 */
final class CourseSelfExamTab extends NativeComponent
{
    use OpensAttachmentBrowser;

    /** @var array<int, mixed> */
    public array $items = [];

    public bool $loading = false;

    public string $error = '';

    /** @var array<string, mixed> */
    public array $errorDetail = [];

    public function retry(): void
    {
        $this->emit('retry');
    }

    /**
     * @param  'action'|'result'  $kind
     */
    public function openItem(string $kind, int $index): void
    {
        $item = array_values($this->items)[$index] ?? null;
        $url = $item === null ? null : ($kind === 'result' ? $item->resultUrl : $item->actionUrl);

        if ($url === null || $url === '') {
            return;
        }

        $this->emit('browser-opened');
        $this->openInAttachmentBrowser($url);
    }

    public function render(): View
    {
        return view('native.courses.course-self-exam-tab');
    }
}
