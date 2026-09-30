<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses;

use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * 討論 tab of CourseShow (CourseDiscussTab.vue): the board list of the course
 * and of its shared course, each board opening the DiscussBoard screen.
 *
 * Props: `courseId`, `boardSections` (`[['courseId', 'title', 'boards' =>
 * BoardViewModel[]]]`), `loading`, `error`, `errorDetail`. Emits `retry`.
 */
final class CourseDiscussTab extends NativeComponent
{
    public string $courseId = '';

    /** @var list<array{courseId: string, title: string, boards: array<int, mixed>}> */
    public array $boardSections = [];

    public bool $loading = false;

    public string $error = '';

    /** @var array<string, mixed> */
    public array $errorDetail = [];

    public function retry(): void
    {
        $this->emit('retry');
    }

    public function openBoard(string $boardCid, string $boardId): void
    {
        $this->navigate($this->route('native.courses.discuss.board.show', [
            'cid' => $this->courseId,
            'boardCid' => $boardCid,
            'bid' => $boardId,
        ]));
    }

    public function isEmpty(): bool
    {
        foreach ($this->boardSections as $section) {
            if (count($section['boards']) > 0) {
                return false;
            }
        }

        return true;
    }

    public function render(): View
    {
        return view('native.courses.course-discuss-tab');
    }
}
