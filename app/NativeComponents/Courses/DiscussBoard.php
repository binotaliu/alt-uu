<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses;

use AltUU\Domains\Course\Actions\ListCourses;
use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use AltUU\Domains\Discuss\Actions\CreatePost;
use AltUU\Domains\Discuss\Actions\ListBoards;
use AltUU\Domains\Discuss\Actions\ListNodes;
use AltUU\Domains\Discuss\ViewModels\BoardViewModel;
use App\NativeComponents\Concerns\GuardsHunguSession;
use App\NativeComponents\Concerns\ShowsSessionExpiredPicker;
use App\NativeComponents\Concerns\ShowsToasts;
use App\NativeComponents\Courses\Concerns\DescribesLoadFailures;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Throwable;

/**
 * Native port of pages/Courses/DiscussBoard.vue: the post list of one board,
 * with a compose sheet and blocked (reported) posts hidden until revealed.
 *
 * Route params: `cid`, `boardCid`, `bid`. Tapping a post opens the
 * DiscussThread screen. The list reloads in `onResume()` so the 未讀 marker
 * updates after reading a thread.
 */
final class DiscussBoard extends NativeComponent
{
    use DescribesLoadFailures;
    use GuardsHunguSession;
    use ShowsSessionExpiredPicker;
    use ShowsToasts;

    public const array REASON_LABELS = [
        's' => '垃圾訊息',
        'i' => '不適當的內容',
        'c' => '受版權保護的內容',
        'p' => '散播個人資訊',
        'l' => '違法內容',
        'm' => '偽冒他人',
        'o' => '其他',
    ];

    public string $cid = '';

    public string $boardCid = '';

    public string $bid = '';

    public ?CourseItemViewModel $course = null;

    public ?BoardViewModel $board = null;

    /** @var array<int, mixed> */
    public array $nodes = [];

    public bool $loading = true;

    public string $error = '';

    /** @var array<string, mixed> */
    public array $errorDetail = [];

    /** @var list<string> */
    public array $revealedNodes = [];

    public bool $composeVisible = false;

    public string $newSubject = '';

    public string $newContent = '';

    public bool $submitting = false;

    public string $composeError = '';

    public function mount(): void
    {
        if (! $this->ensureHunguSession()) {
            return;
        }

        $this->cid = (string) $this->param('cid');
        $this->boardCid = (string) $this->param('boardCid');
        $this->bid = (string) $this->param('bid');

        $this->loadCourse();
        $this->load();
    }

    public function retry(): void
    {
        $this->load();
    }

    public function onResume(): void
    {
        if ($this->handleSessionExpired() || $this->loading || $this->error !== '') {
            return;
        }

        $this->load(silent: true);
    }

    protected function onAccountSwitched(int $accountId): void
    {
        $this->replace($this->route('native.courses.index'));
    }

    public function revealNode(string $nodeId): void
    {
        if (! in_array($nodeId, $this->revealedNodes, true)) {
            $this->revealedNodes[] = $nodeId;
        }
    }

    public function openNode(string $nodeId): void
    {
        $this->navigate($this->route('native.courses.discuss.thread.show', [
            'cid' => $this->cid,
            'boardCid' => $this->boardCid,
            'bid' => $this->bid,
            'nid' => $nodeId,
        ]));
    }

    public function openCompose(): void
    {
        if (! $this->canCreatePost()) {
            return;
        }

        $this->composeError = '';
        $this->composeVisible = true;
    }

    public function closeCompose(): void
    {
        if ($this->submitting) {
            return;
        }

        $this->composeVisible = false;
    }

    public function submitPost(): void
    {
        if ($this->submitting) {
            return;
        }

        if (! $this->canCreatePost()) {
            $this->composeError = '本討論板禁止發文。';

            return;
        }

        if (trim($this->newContent) === '') {
            $this->composeError = '請輸入文章內容。';

            return;
        }

        $this->submitting = true;
        $this->composeError = '';

        try {
            app(CreatePost::class)(
                $this->bid,
                trim($this->newSubject) !== '' ? $this->newSubject : '新文章',
                $this->newContent,
            );
        } catch (Throwable $exception) {
            report($exception);

            if (! $this->handleSessionExpired()) {
                $this->composeError = $this->failureMessage($exception, '送出文章失敗');
            }

            $this->submitting = false;

            return;
        }

        $this->newSubject = '';
        $this->newContent = '';
        $this->composeVisible = false;
        $this->submitting = false;
        $this->load(silent: true);
    }

    public function canCreatePost(): bool
    {
        return $this->board?->allowPost ?? false;
    }

    public function courseTitle(): string
    {
        $name = $this->course?->name;

        return $name !== null && $name !== '' ? $name : "課程 {$this->cid}";
    }

    public function boardTitle(): string
    {
        $name = $this->board?->boardName;

        return $name !== null && $name !== '' ? $name : '討論板';
    }

    public function navTitle(): string
    {
        return $this->boardTitle();
    }

    public function reasonLabel(?string $reason): string
    {
        return self::REASON_LABELS[$reason ?? ''] ?? '其他';
    }

    public function isRevealed(string $nodeId): bool
    {
        return in_array($nodeId, $this->revealedNodes, true);
    }

    public function render(): View
    {
        return view('native.courses.discuss-board');
    }

    private function loadCourse(): void
    {
        try {
            $this->course = collect(app(ListCourses::class)()->items())
                ->first(fn (CourseItemViewModel $item): bool => $item->courseId === $this->cid);
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    /**
     * A silent reload (after resume or posting) keeps the current list when
     * it fails instead of replacing it with the error card.
     */
    private function load(bool $silent = false): void
    {
        if (! $silent) {
            $this->loading = true;
            $this->error = '';
            $this->errorDetail = [];
        }

        try {
            $boards = app(ListBoards::class)($this->boardCid)->boards;
            $this->board = collect($boards)->first(fn (BoardViewModel $item): bool => $item->boardId === $this->bid);
            $this->nodes = app(ListNodes::class)($this->boardCid, $this->bid)->nodes;
        } catch (Throwable $exception) {
            report($exception);

            if ($this->handleSessionExpired()) {
                $this->loading = false;

                return;
            }

            if (! $silent) {
                $this->error = $this->failureMessage($exception, '載入討論板失敗');
                $this->errorDetail = $this->failureDetail($exception, '文章列表');
            }
        } finally {
            $this->loading = false;
        }
    }
}
