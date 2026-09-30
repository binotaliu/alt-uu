<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses;

use AltUU\Domains\AppPreference\Actions\GetAppearance;
use AltUU\Domains\Course\Actions\ListCourses;
use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use AltUU\Domains\Discuss\Actions\CreatePost;
use AltUU\Domains\Discuss\Actions\CreateWhisper;
use AltUU\Domains\Discuss\Actions\DeleteWhisper;
use AltUU\Domains\Discuss\Actions\LikePost;
use AltUU\Domains\Discuss\Actions\ListBoards;
use AltUU\Domains\Discuss\Actions\ListNodes;
use AltUU\Domains\Discuss\Actions\ListPosts;
use AltUU\Domains\Discuss\Actions\SetForumRead;
use AltUU\Domains\Discuss\Actions\UnlikePost;
use AltUU\Domains\Discuss\Actions\UpdateWhisper;
use AltUU\Domains\Discuss\ViewModels\BoardViewModel;
use AltUU\Domains\Discuss\ViewModels\NodeViewModel;
use AltUU\Domains\Discuss\ViewModels\PostViewModel;
use AltUU\Domains\Moderation\Actions\BlockUser;
use AltUU\Domains\Moderation\Actions\GetBlockedUsers;
use AltUU\Domains\Moderation\Actions\ReportContent;
use AltUU\Domains\Moderation\Actions\UnblockUser;
use AltUU\Domains\Moderation\ViewModels\BlockedUserViewModel;
use App\NativeComponents\Concerns\GuardsHunguSession;
use App\NativeComponents\Concerns\ShowsSessionExpiredPicker;
use App\NativeComponents\Concerns\ShowsToasts;
use App\NativeComponents\Courses\Concerns\DescribesLoadFailures;
use App\Services\UUCourseClient;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Edge\SharedValue;
use Throwable;

/**
 * Native port of pages/Courses/DiscussThread.vue: one thread of a board with
 * its replies (floors), likes, whispers (留言), report / block moderation,
 * image attachments and a fullscreen image viewer.
 *
 * Route params: `cid`, `boardCid`, `bid`, `nid`. Each floor is a
 * `DiscussPostCard` child; the screen owns every sheet and every data change.
 * Post bodies render as plain `native:text` when the sanitised HTML has no
 * markup beyond paragraphs and line breaks, and through `native:html-content`
 * (auto-height web view) otherwise. Only `PAGE_SIZE` floors are drawn at a
 * time (a "顯示更多" row reveals the next ones) so a long thread does not
 * stack dozens of web views at once.
 *
 * Editing or deleting one's own post is not offered: the Vue page has it
 * commented out and the post view model carries no ownership flag. Whispers
 * can be edited / deleted when the school marks them `canDelete`.
 */
final class DiscussThread extends NativeComponent
{
    use DescribesLoadFailures;
    use GuardsHunguSession;
    use ShowsSessionExpiredPicker;
    use ShowsToasts;

    public const int PAGE_SIZE = 15;

    public const array REPORT_REASONS = [
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

    public string $nid = '';

    public ?CourseItemViewModel $course = null;

    public string $boardName = '';

    public string $nodeSubject = '';

    /** @var array<int, PostViewModel> */
    public array $posts = [];

    /** @var array<int, array{poster: string, realname: string}> */
    public array $blockedUsers = [];

    /** @var list<string> */
    public array $revealedPosts = [];

    public int $visibleCount = self::PAGE_SIZE;

    public bool $loading = true;

    public string $error = '';

    /** @var array<string, mixed> */
    public array $errorDetail = [];

    /** `auto` (follow the device), `light` or `dark`, resolved from the appearance preference. */
    public string $appearance = 'auto';

    public ?string $schoolBaseUrl = null;

    public bool $replyVisible = false;

    public string $replySubject = '';

    public string $replyContent = '';

    public bool $replySubmitting = false;

    public string $replyError = '';

    public bool $whisperVisible = false;

    public string $whisperNodeId = '';

    public ?int $whisperFloor = null;

    public string $whisperId = '';

    public string $whisperContent = '';

    public bool $whisperSubmitting = false;

    public string $whisperError = '';

    public bool $deleteWhisperVisible = false;

    public string $deleteWhisperNodeId = '';

    public string $deleteWhisperId = '';

    public bool $deletingWhisper = false;

    public bool $reportVisible = false;

    public string $reportNodeId = '';

    public string $reportContent = '';

    public string $reportType = '';

    public bool $reportSubmitting = false;

    public ?bool $reportSuccess = null;

    public bool $blockVisible = false;

    public string $blockPoster = '';

    public string $blockRealname = '';

    public bool $blocking = false;

    public string $lightboxSrc = '';

    public string $lightboxAlt = '';

    /** @var list<string> */
    public array $likingNodes = [];

    public function mount(): void
    {
        if (! $this->ensureHunguSession()) {
            return;
        }

        $this->cid = (string) $this->param('cid');
        $this->boardCid = (string) $this->param('boardCid');
        $this->bid = (string) $this->param('bid');
        $this->nid = (string) $this->param('nid');

        $this->appearance = $this->resolveAppearance();
        $this->schoolBaseUrl = $this->resolveSchoolBaseUrl();

        $this->loadCourse();
        $this->load();

        if ($this->error === '') {
            $this->markRead();
        }
    }

    public function retry(): void
    {
        $this->load();
    }

    public function onResume(): void
    {
        if ($this->handleSessionExpired()) {
            return;
        }

        $this->appearance = $this->resolveAppearance();
    }

    protected function onAccountSwitched(int $accountId): void
    {
        $this->replace($this->route('native.courses.index'));
    }

    // ---- display helpers -------------------------------------------------

    public function courseTitle(): string
    {
        $name = $this->course?->name;

        return $name !== null && $name !== '' ? $name : "課程 {$this->cid}";
    }

    public function boardTitle(): string
    {
        return $this->boardName !== '' ? $this->boardName : '討論板';
    }

    public function threadTitle(): string
    {
        if ($this->nodeSubject !== '') {
            return $this->nodeSubject;
        }

        foreach ($this->posts as $post) {
            if ($post->subject !== null && $post->subject !== '') {
                return $post->subject;
            }
        }

        return '文章內容';
    }

    public function navTitle(): string
    {
        return $this->boardTitle();
    }

    /**
     * @return array<int, PostViewModel>
     */
    public function visiblePosts(): array
    {
        return array_slice($this->posts, 0, $this->visibleCount);
    }

    public function hiddenPostCount(): int
    {
        return max(0, count($this->posts) - $this->visibleCount);
    }

    public function showMore(): void
    {
        $this->visibleCount += self::PAGE_SIZE;
    }

    public function reasonLabel(?string $reason): string
    {
        return self::REPORT_REASONS[$reason ?? ''] ?? '其他';
    }

    public function isRevealed(?string $node): bool
    {
        return $node !== null && in_array($node, $this->revealedPosts, true);
    }

    public function isUserBlocked(?string $poster, ?string $realname): bool
    {
        if ($poster === null || $poster === '' || $realname === null || $realname === '') {
            return false;
        }

        foreach ($this->blockedUsers as $blocked) {
            if ($blocked['poster'] === $poster && $blocked['realname'] === $realname) {
                return true;
            }
        }

        return false;
    }

    // ---- reply -----------------------------------------------------------

    public function openReply(): void
    {
        $this->replyError = '';
        $this->replyVisible = true;
    }

    public function closeReply(): void
    {
        if (! $this->replySubmitting) {
            $this->replyVisible = false;
        }
    }

    public function submitReply(): void
    {
        if ($this->replySubmitting) {
            return;
        }

        if (trim($this->replyContent) === '') {
            $this->replyError = '請輸入回覆內容。';

            return;
        }

        $this->replySubmitting = true;
        $this->replyError = '';

        try {
            app(CreatePost::class)(
                $this->bid,
                trim($this->replySubject) !== '' ? $this->replySubject : '回覆',
                $this->replyContent,
                null,
                $this->nid,
            );
        } catch (Throwable $exception) {
            report($exception);

            if (! $this->handleSessionExpired()) {
                $this->replyError = $this->failureMessage($exception, '送出回覆失敗');
            }

            $this->replySubmitting = false;

            return;
        }

        $this->replySubject = '';
        $this->replyContent = '';
        $this->replyVisible = false;
        $this->replySubmitting = false;
        $this->load(silent: true);
    }

    // ---- like ------------------------------------------------------------

    public function toggleLike(string $node, bool $liked): void
    {
        if (in_array($node, $this->likingNodes, true)) {
            return;
        }

        $this->likingNodes[] = $node;
        $this->applyLike($node, ! $liked);

        try {
            $liked ? app(UnlikePost::class)($this->bid, $node) : app(LikePost::class)($this->bid, $node);
        } catch (Throwable $exception) {
            report($exception);
            $this->applyLike($node, $liked);

            if (! $this->handleSessionExpired()) {
                $this->toastError($this->failureMessage($exception, '操作失敗，請稍後再試。'));
            }
        }

        $this->likingNodes = array_values(array_diff($this->likingNodes, [$node]));
        $this->load(silent: true);
    }

    // ---- whispers --------------------------------------------------------

    public function openWhisperCreate(string $node, int $floor): void
    {
        $this->whisperNodeId = $node;
        $this->whisperFloor = $floor;
        $this->whisperId = '';
        $this->whisperContent = '';
        $this->whisperError = '';
        $this->whisperVisible = true;
    }

    public function openWhisperEdit(string $node, string $whisperId, string $content): void
    {
        $this->whisperNodeId = $node;
        $this->whisperFloor = $this->floorOf($node);
        $this->whisperId = $whisperId;
        $this->whisperContent = $content;
        $this->whisperError = '';
        $this->whisperVisible = true;
    }

    public function closeWhisper(): void
    {
        if (! $this->whisperSubmitting) {
            $this->whisperVisible = false;
        }
    }

    public function submitWhisper(): void
    {
        if ($this->whisperSubmitting || $this->whisperNodeId === '') {
            return;
        }

        if (trim($this->whisperContent) === '') {
            $this->whisperError = '請輸入留言內容。';

            return;
        }

        $this->whisperSubmitting = true;
        $this->whisperError = '';

        try {
            if ($this->whisperId !== '') {
                app(UpdateWhisper::class)($this->bid, $this->whisperNodeId, $this->whisperId, trim($this->whisperContent));
            } else {
                app(CreateWhisper::class)($this->bid, $this->whisperNodeId, trim($this->whisperContent));
            }
        } catch (Throwable $exception) {
            report($exception);

            if (! $this->handleSessionExpired()) {
                $this->whisperError = $this->failureMessage($exception, '送出留言失敗');
            }

            $this->whisperSubmitting = false;

            return;
        }

        $this->whisperContent = '';
        $this->whisperId = '';
        $this->whisperVisible = false;
        $this->whisperSubmitting = false;
        $this->load(silent: true);
    }

    public function askDeleteWhisper(string $node, string $whisperId): void
    {
        $this->deleteWhisperNodeId = $node;
        $this->deleteWhisperId = $whisperId;
        $this->deleteWhisperVisible = true;
    }

    public function cancelDeleteWhisper(): void
    {
        if (! $this->deletingWhisper) {
            $this->deleteWhisperVisible = false;
        }
    }

    public function confirmDeleteWhisper(): void
    {
        if ($this->deletingWhisper || $this->deleteWhisperId === '') {
            return;
        }

        $this->deletingWhisper = true;

        try {
            app(DeleteWhisper::class)($this->bid, $this->deleteWhisperNodeId, $this->deleteWhisperId);
        } catch (Throwable $exception) {
            report($exception);

            if (! $this->handleSessionExpired()) {
                $this->toastError($this->failureMessage($exception, '刪除留言失敗'));
            }

            $this->deletingWhisper = false;
            $this->deleteWhisperVisible = false;

            return;
        }

        $this->deletingWhisper = false;
        $this->deleteWhisperVisible = false;
        $this->deleteWhisperId = '';
        $this->load(silent: true);
    }

    // ---- moderation ------------------------------------------------------

    public function revealPost(string $node): void
    {
        if (! in_array($node, $this->revealedPosts, true)) {
            $this->revealedPosts[] = $node;
        }
    }

    public function openReport(string $node): void
    {
        $this->reportNodeId = $node;
        $this->reportContent = $this->postByNode($node)?->content ?? '';
        $this->reportType = '';
        $this->reportSuccess = null;
        $this->reportVisible = true;
    }

    public function closeReport(): void
    {
        if (! $this->reportSubmitting) {
            $this->reportVisible = false;
        }
    }

    public function selectReportReason(string $reason): void
    {
        if (array_key_exists($reason, self::REPORT_REASONS) && ! $this->reportSubmitting) {
            $this->reportType = $reason;
        }
    }

    public function submitReport(): void
    {
        if ($this->reportSubmitting || $this->reportNodeId === '' || $this->reportType === '') {
            return;
        }

        $this->reportSubmitting = true;

        try {
            $this->reportSuccess = app(ReportContent::class)($this->bid, $this->reportNodeId, $this->reportContent, $this->reportType);
        } catch (Throwable $exception) {
            report($exception);
            $this->reportSuccess = false;
        }

        $this->reportSubmitting = false;

        if ($this->reportSuccess) {
            $this->reportVisible = false;
            $this->toastSuccess('檢舉已送出，感謝你的回報。');
        }
    }

    public function askBlock(string $poster, string $realname): void
    {
        $this->blockPoster = $poster;
        $this->blockRealname = $realname;
        $this->blockVisible = true;
    }

    public function cancelBlock(): void
    {
        if (! $this->blocking) {
            $this->blockVisible = false;
        }
    }

    public function confirmBlock(): void
    {
        if ($this->blocking || $this->blockPoster === '' || $this->blockRealname === '') {
            return;
        }

        $this->blocking = true;

        try {
            app(BlockUser::class)($this->blockPoster, $this->blockRealname);
            $this->loadBlockedUsers();
        } catch (Throwable $exception) {
            report($exception);
            $this->toastError('封鎖失敗，請稍後再試。');
        }

        $this->blocking = false;
        $this->blockVisible = false;
    }

    public function unblock(string $poster, string $realname): void
    {
        try {
            app(UnblockUser::class)($poster, $realname);
            $this->loadBlockedUsers();
        } catch (Throwable $exception) {
            report($exception);
            $this->toastError('解除封鎖失敗，請稍後再試。');
        }
    }

    // ---- images ----------------------------------------------------------

    public function openImage(string $path, string $alt): void
    {
        $this->lightboxSrc = $path;
        $this->lightboxAlt = $alt;
    }

    public function closeImage(): void
    {
        $this->lightboxSrc = '';
        $this->lightboxAlt = '';
    }

    public function render(): View
    {
        return view('native.courses.discuss-thread', ['lightboxZoom' => SharedValue::make(1.0)]);
    }

    // ---- loading ---------------------------------------------------------

    private function resolveAppearance(): string
    {
        try {
            $appearance = app(GetAppearance::class)();
        } catch (Throwable) {
            return 'auto';
        }

        return in_array($appearance, ['light', 'dark'], true) ? $appearance : 'auto';
    }

    private function resolveSchoolBaseUrl(): ?string
    {
        try {
            return app(UUCourseClient::class)->currentBaseUrl();
        } catch (Throwable) {
            return null;
        }
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

    private function loadBlockedUsers(): void
    {
        $this->blockedUsers = array_map(
            static fn (BlockedUserViewModel $user): array => ['poster' => $user->poster, 'realname' => $user->realname],
            app(GetBlockedUsers::class)(),
        );
    }

    /**
     * A silent reload (after posting, liking, whispering) keeps the current
     * floors when it fails instead of replacing them with the error card.
     */
    private function load(bool $silent = false): void
    {
        if (! $silent) {
            $this->loading = true;
            $this->error = '';
            $this->errorDetail = [];
        }

        try {
            $this->posts = app(ListPosts::class)($this->boardCid, $this->bid, $this->nid)->posts;
            $this->loadBlockedUsers();
            $this->loadTitles();
        } catch (Throwable $exception) {
            report($exception);

            if ($this->handleSessionExpired()) {
                $this->loading = false;

                return;
            }

            if (! $silent) {
                $this->error = $this->failureMessage($exception, '載入討論串失敗');
                $this->errorDetail = $this->failureDetail($exception, '討論串內容');
            }
        } finally {
            $this->loading = false;
        }
    }

    /**
     * Board and thread titles only decorate the header, so a failure here
     * must not hide the floors that did load.
     */
    private function loadTitles(): void
    {
        try {
            $boards = app(ListBoards::class)($this->boardCid)->boards;
            $this->boardName = collect($boards)
                ->first(fn (BoardViewModel $item): bool => $item->boardId === $this->bid)?->boardName ?? '';

            $nodes = app(ListNodes::class)($this->boardCid, $this->bid)->nodes;
            $this->nodeSubject = collect($nodes)
                ->first(fn (NodeViewModel $item): bool => $item->node === $this->nid)?->subject ?? '';
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    private function markRead(): void
    {
        try {
            app(SetForumRead::class)($this->nid);
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    private function applyLike(string $node, bool $liked): void
    {
        foreach ($this->posts as $post) {
            if ($post->node === $node) {
                $post->liked = $liked;
                $post->push = max(0, $post->push + ($liked ? 1 : -1));
            }
        }
    }

    private function postByNode(string $node): ?PostViewModel
    {
        foreach ($this->posts as $post) {
            if ($post->node === $node) {
                return $post;
            }
        }

        return null;
    }

    private function floorOf(string $node): ?int
    {
        return $this->postByNode($node)?->floor;
    }
}
