<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses;

use AltUU\AttachmentBridge\Facades\AttachmentBridge;
use AltUU\Domains\AppPreference\Actions\GetAppearance;
use AltUU\Domains\AppPreference\Actions\GetCellularPlaybackWarningEnabled;
use AltUU\Domains\AppPreference\Actions\SetCellularPlaybackWarningEnabled;
use AltUU\Domains\AppPreference\DataTransferObjects\SetCellularPlaybackWarningEnabledInputData;
use AltUU\Domains\Auth\Actions\GetSessionProfile;
use AltUU\Domains\Course\Actions\GetCourseLearningTimeItems;
use AltUU\Domains\Course\Actions\GetCoursePathInfo;
use AltUU\Domains\Course\Actions\GetNodeResources;
use AltUU\Domains\Course\Actions\ListCourses;
use AltUU\Domains\Course\Actions\ParseMaterialContent;
use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use AltUU\Domains\Course\ViewModels\CourseMaterialNodeViewModel;
use AltUU\Domains\Course\ViewModels\ParsedMaterialContentViewModel;
use AltUU\Domains\MaterialPreference\Actions\GetMaterialFontScale;
use AltUU\Domains\MaterialPreference\Actions\SetMaterialFontScale;
use AltUU\Domains\MaterialPreference\DataTransferObjects\SetMaterialFontScaleInputData;
use AltUU\Domains\StudyTime\Actions\GetLastSeenMaterial;
use AltUU\Domains\StudyTime\Actions\GetPlaybackProgress;
use AltUU\Domains\StudyTime\Actions\RecordStudyTime;
use AltUU\MediaPlayer\Facades\MediaPlayer;
use App\NativeComponents\Concerns\GuardsHunguSession;
use App\NativeComponents\Concerns\ShowsSessionExpiredPicker;
use App\NativeComponents\Concerns\ShowsToasts;
use App\NativeComponents\Courses\Concerns\DescribesLoadFailures;
use App\NativeComponents\Courses\Concerns\OpensAttachmentBrowser;
use App\NativeComponents\Courses\Material\ActiveMediaSession;
use App\NativeComponents\Courses\Material\MaterialUrls;
use App\NativeComponents\Support\TronclassLink;
use App\Services\UUCourseClient;
use Illuminate\Support\Facades\Date;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Native\Mobile\Attributes\Lazy;
use Native\Mobile\Attributes\Poll;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Facades\Browser;
use Native\Mobile\Facades\Network;
use Throwable;

/**
 * Native port of pages/Courses/Material.vue + components/MaterialViewer.vue +
 * composables/useStudyTimer.ts: one course material (video, audio, YouTube,
 * article HTML, PDF / file download) with prev/next navigation, the tablet
 * sidebar, the resume and cellular prompts and the study timer.
 *
 * Route params: `cid`, `scoid`. The node is switched IN PLACE (state keeps the
 * timer, prompts and directory; no `replace()`), as the Vue `router.replace`
 * only kept the URL in sync.
 *
 * Viewer kinds, decided by `ParseMaterialContent`:
 *  - video / audio: `<native:media-playback>` (only mounted once the cellular
 *    warning and the resume prompt are answered, because `start` and
 *    `autoplay` apply to a freshly built player only);
 *  - YouTube: `<native:html-content embed-url>`; its progress messages feed the
 *    timer, there is no inbound seek, so no resume prompt;
 *  - article: `<native:html-content>` with the font scale preference, dark
 *    remap and link events (node / sub-page / tronclass / external / mailto / tel);
 *  - PDF and other files: `<native:attachment-row>`.
 *
 * Study timer (see conventions.md, "Material screen notes"): the segment start
 * is sent to `RecordStudyTime` and reset after every successful save, so the
 * periodic checkpoint (every CHECKPOINT_SECONDS from the 1 s poll), node
 * switches and leaving never count the same span twice. Saves happen on node
 * switch, on back (`onBackPressed`, which iOS also fires after its own edge
 * swipe / nav-bar pop) and as a safety net in `unmount()`. There is no
 * app-background hook in NativePHP, so time since the last checkpoint is lost
 * when the app is killed.
 */
#[Lazy]
final class Material extends NativeComponent
{
    use DescribesLoadFailures;
    use GuardsHunguSession;
    use OpensAttachmentBrowser;
    use ShowsSessionExpiredPicker;
    use ShowsToasts;

    public const int MIN_RESUME_SECONDS = 3;

    public const int MIN_SAVE_SECONDS = 3;

    public const int MAX_SAVE_SECONDS = 28800;

    public const int CHECKPOINT_SECONDS = 300;

    public const int CHECKPOINT_RETRY_SECONDS = 60;

    public const float FONT_SCALE_STEP = 0.1;

    public const float FONT_SCALE_MIN = 0.7;

    public const float FONT_SCALE_MAX = 1.6;

    public string $cid = '';

    public string $activeNodeIdentifier = '';

    public ?CourseItemViewModel $course = null;

    /** @var array<int, CourseMaterialNodeViewModel> */
    public array $materialNodes = [];

    /** @var array<int, mixed> */
    public array $learningTimeItems = [];

    public bool $learningTimesStale = true;

    public ?string $lastSeenIdentifier = null;

    public ?int $lastSeenPositionSeconds = null;

    public ?int $lastSeenDurationSeconds = null;

    public bool $loading = true;

    public string $error = '';

    /** @var array<string, mixed> */
    public array $errorDetail = [];

    public ?ParsedMaterialContentViewModel $content = null;

    /** @var array<int, mixed> */
    public array $resources = [];

    /** URL the current content was parsed from: the node href or a sub-page of it. */
    public ?string $contentUrl = null;

    public string $html = '';

    public ?string $subtitleUrl = null;

    public ?string $downloadUrl = null;

    /** `auto` (follow the device), `light` or `dark`, resolved from the appearance preference. */
    public string $appearance = 'auto';

    public float $fontScale = 1.0;

    public string $studentId = '';

    public bool $mediaReady = false;

    public float $mediaStart = 0.0;

    public bool $mediaAutoplay = false;

    public float $playbackRate = 1.0;

    public string $playerError = '';

    /** @var array{position: float, label: string}|null */
    public ?array $resumePrompt = null;

    public bool $cellularPromptVisible = false;

    public bool $cellularDontAsk = false;

    public bool $saving = false;

    public ?string $pendingNode = null;

    public bool $reloading = false;

    public string $reloadError = '';

    public bool $capturing = false;

    public string $captureError = '';

    /** Start of the span the next `RecordStudyTime` call will record. */
    public ?string $segmentStartedAt = null;

    /** Start of the node visit; drives the clock chip and never resets on a save. */
    public ?string $displayStartedAt = null;

    public ?float $lastPosition = null;

    public ?float $lastDuration = null;

    public ?string $restoredStartedAt = null;

    public bool $nativeRestored = false;

    public bool $timerClosed = false;

    /** The session died while this screen stayed open (session picker); nothing is sent until it is valid again. */
    public bool $timerSuspended = false;

    private int $checkpointRetryAt = 0;

    private bool $sessionLostWhileSaving = false;

    public function placeholder(): View
    {
        return view('native.courses.material-placeholder');
    }

    public function mount(): void
    {
        if (! $this->ensureHunguSession()) {
            return;
        }

        $this->cid = (string) $this->param('cid');
        $this->activeNodeIdentifier = (string) $this->param('scoid');

        $this->appearance = $this->resolveAppearance();
        $this->fontScale = $this->resolveFontScale();
        $this->studentId = $this->resolveStudentId();

        if (! $this->loadShell() || $this->error !== '') {
            $this->loading = false;

            return;
        }

        $this->restoreNativeState();
        $this->openNode();
    }

    public function retry(): void
    {
        if ($this->materialNodes === []) {
            $this->error = '';

            if (! $this->loadShell() || $this->error !== '') {
                return;
            }
        }

        $this->openNode(startTimer: $this->segmentStartedAt === null);
    }

    public function onResume(): void
    {
        if ($this->sessionExpired()) {
            return;
        }

        $this->timerSuspended = false;
    }

    protected function onAccountSwitched(int $accountId): void
    {
        $this->timerClosed = true;
        $this->replace($this->route('native.courses.index'));
    }

    // ---- study timer -----------------------------------------------------

    /**
     * Once a second: finishes a pending node switch (the saving overlay was
     * painted by the render in between), refreshes the sidebar durations and
     * saves a checkpoint of the study time.
     */
    #[Poll(1000)]
    public function tick(): void
    {
        if ($this->pendingNode !== null) {
            $this->completeNodeSwitch();

            return;
        }

        if ($this->loading || $this->error !== '') {
            return;
        }

        if ($this->learningTimesStale) {
            $this->learningTimesStale = false;
            $this->loadLearningTimes();
        }

        $this->saveCheckpointIfDue();
    }

    public function elapsedSeconds(): int
    {
        return $this->secondsSince($this->displayStartedAt);
    }

    public function clock(): string
    {
        return MaterialUrls::clock($this->elapsedSeconds());
    }

    public function isTracking(): bool
    {
        return $this->displayStartedAt !== null && ! $this->timerClosed;
    }

    /**
     * Sends the running span to the school (with the media position) and
     * starts the next span. Returns true when nothing needed saving or the
     * save went through.
     */
    private function saveStudyTime(): bool
    {
        $node = $this->activeNode();

        if ($this->segmentStartedAt === null || $this->timerSuspended || $node === null || ($node->href ?? '') === '') {
            return true;
        }

        $seconds = $this->secondsSince($this->segmentStartedAt);

        if ($seconds < self::MIN_SAVE_SECONDS) {
            return true;
        }

        $this->refreshPlaybackSnapshot();

        $payload = [
            'cid' => $this->cid,
            'activityId' => $node->identifier,
            'url' => $node->href,
            'seconds' => min($seconds, self::MAX_SAVE_SECONDS),
            'startedAt' => $this->segmentStartedAt,
        ];

        if ($this->lastPosition !== null && $this->lastPosition > 0) {
            $payload['positionSeconds'] = $this->lastPosition;
        }

        if ($this->lastDuration !== null && $this->lastDuration > 0) {
            $payload['mediaDurationSeconds'] = $this->lastDuration;
        }

        if (! $this->submitStudyTime($payload)) {
            return false;
        }

        $this->segmentStartedAt = Date::now()->toIso8601String();
        $this->learningTimesStale = true;

        return true;
    }

    /**
     * Port of `saveStudyTimeWithRetry`: a thrown failure re-validates the
     * session (the equivalent of `/api/auth/bootstrap-session`) and retries
     * once. A validation error is not a session problem, and an upstream
     * `ok: false` is accepted like the SPA accepted any HTTP 200, because the
     * Action already stored the local progress and daily activity (a retry
     * would count them twice).
     *
     * @param  array<string, mixed>  $payload
     */
    private function submitStudyTime(array $payload): bool
    {
        $this->sessionLostWhileSaving = false;

        for ($attempt = 0; $attempt < 2; $attempt++) {
            try {
                app(RecordStudyTime::class)($payload);

                return true;
            } catch (ValidationException $exception) {
                report($exception);

                return false;
            } catch (Throwable $exception) {
                report($exception);

                if ($attempt === 1) {
                    return false;
                }

                try {
                    $proceeds = $this->hunguSessionGuardResult(validateRemotely: true)->proceeds;
                } catch (Throwable $validation) {
                    // Offline: the re-validation fails the same way, so there is nothing to retry.
                    report($validation);

                    return false;
                }

                if (! $proceeds) {
                    $this->sessionLostWhileSaving = true;

                    return false;
                }
            }
        }

        return false;
    }

    private function saveCheckpointIfDue(): void
    {
        if ($this->timerClosed || $this->timerSuspended || $this->segmentStartedAt === null || $this->saving) {
            return;
        }

        $now = Date::now()->getTimestamp();

        if ($now < $this->checkpointRetryAt || $this->secondsSince($this->segmentStartedAt) < self::CHECKPOINT_SECONDS) {
            return;
        }

        if ($this->saveStudyTime()) {
            return;
        }

        if ($this->sessionLostWhileSaving) {
            $this->sessionExpired();

            return;
        }

        $this->checkpointRetryAt = $now + self::CHECKPOINT_RETRY_SECONDS;
    }

    /**
     * Saves for the last time. Runs for back navigation and again from
     * `unmount()` (a no-op the second time).
     */
    private function closeTimer(): void
    {
        if ($this->timerClosed) {
            return;
        }

        $this->timerClosed = true;

        if (! $this->saveStudyTime()) {
            $this->toastError('學習進度儲存失敗');
        }

        $this->segmentStartedAt = null;
    }

    private function beginTracking(): void
    {
        if ($this->segmentStartedAt !== null || $this->timerClosed) {
            return;
        }

        $node = $this->activeNode();
        $restored = $this->restoredStartedAt;
        $this->restoredStartedAt = null;

        if ($node === null || ($node->href ?? '') === '') {
            $this->segmentStartedAt = null;
            $this->displayStartedAt = null;

            return;
        }

        $startedAt = $restored !== null ? $this->parseInstant($restored) : null;
        $startedAt ??= Date::now()->toIso8601String();

        $this->segmentStartedAt = $startedAt;
        $this->displayStartedAt = $startedAt;
        $this->lastPosition = null;
        $this->lastDuration = null;
        $this->checkpointRetryAt = 0;
    }

    private function secondsSince(?string $instant): int
    {
        if ($instant === null) {
            return 0;
        }

        return max(0, Date::now()->getTimestamp() - Date::parse($instant)->getTimestamp());
    }

    private function parseInstant(string $value): ?string
    {
        try {
            return Date::parse($value)->toIso8601String();
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * Position and duration of the running media; a 0 from the bridge means
     * "unknown", so the last value a progress event carried is kept.
     */
    private function refreshPlaybackSnapshot(): void
    {
        if (! $this->hasNativePlayer()) {
            return;
        }

        try {
            $position = MediaPlayer::getCurrentTime();
            $duration = MediaPlayer::getDuration();
        } catch (Throwable) {
            return;
        }

        if ($position > 0) {
            $this->lastPosition = $position;
        }

        if ($duration > 0) {
            $this->lastDuration = $duration;
        }
    }

    // ---- node loading ----------------------------------------------------

    /**
     * Returns false when the session is gone (the screen is being replaced
     * or the session picker is open).
     */
    private function loadShell(): bool
    {
        try {
            $this->course = collect(app(ListCourses::class)()->items())
                ->first(fn (CourseItemViewModel $item): bool => $item->courseId === $this->cid);
        } catch (Throwable $exception) {
            report($exception);

            if ($this->sessionExpired()) {
                return false;
            }
        }

        try {
            app(SyncCurrentCourse::class)($this->cid);
            $this->materialNodes = app(GetCoursePathInfo::class)($this->cid)['materialNodes']->items();
        } catch (Throwable $exception) {
            report($exception);

            if ($this->sessionExpired()) {
                return false;
            }

            $this->error = $this->failureMessage($exception, '載入教材目錄失敗');
            $this->errorDetail = $this->failureDetail($exception, '教材目錄');

            return true;
        }

        try {
            $lastSeen = app(GetLastSeenMaterial::class)($this->cid);
            $this->lastSeenIdentifier = $lastSeen->activityId;
            $this->lastSeenPositionSeconds = $lastSeen->positionSeconds !== null ? (int) round($lastSeen->positionSeconds) : null;
            $this->lastSeenDurationSeconds = $lastSeen->mediaDurationSeconds !== null ? (int) round($lastSeen->mediaDurationSeconds) : null;
        } catch (Throwable $exception) {
            report($exception);
        }

        return true;
    }

    private function loadLearningTimes(): void
    {
        try {
            $this->learningTimeItems = app(GetCourseLearningTimeItems::class)($this->cid)->items();
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    /**
     * Loads the active node: resources and parsed content, then the cellular
     * warning, the timer and the resume prompt. `$startTimer` is false when the
     * running visit continues (a link to the current node).
     */
    private function openNode(bool $startTimer = true): void
    {
        $this->resetNodeState();
        $this->loading = true;
        $this->error = '';
        $this->errorDetail = [];

        try {
            $this->resources = app(GetNodeResources::class)($this->cid, $this->activeNodeIdentifier)->items();
            $this->applyContent($this->parseNode());
        } catch (Throwable $exception) {
            report($exception);

            if ($this->sessionExpired()) {
                $this->loading = false;

                return;
            }

            $this->applyContent(null);
            $this->error = $this->failureMessage($exception, '載入教材內容失敗');
            $this->errorDetail = $this->failureDetail($exception, '教材內容');
        }

        $this->loading = false;
        $this->learningTimesStale = true;

        if ($this->error === '' && $this->needsCellularPrompt()) {
            $this->cellularDontAsk = false;
            $this->cellularPromptVisible = true;

            return;
        }

        if ($startTimer) {
            $this->beginTracking();
        }

        $this->prepareMedia();
    }

    private function resetNodeState(): void
    {
        $this->applyContent(null);
        $this->resources = [];
        $this->mediaReady = false;
        $this->mediaStart = 0.0;
        $this->mediaAutoplay = false;
        $this->playerError = '';
        $this->resumePrompt = null;
        $this->cellularPromptVisible = false;
        $this->reloadError = '';
        $this->captureError = '';
        $this->playbackRate = $this->currentPlaybackRate();
    }

    private function parseNode(): ParsedMaterialContentViewModel
    {
        $node = $this->activeNode();

        if ($node === null || ($node->href ?? '') === '') {
            $this->contentUrl = null;

            return ParsedMaterialContentViewModel::emptyContent();
        }

        $this->contentUrl = $node->href;

        return $this->parseUrl((string) $node->href) ?? ParsedMaterialContentViewModel::emptyContent();
    }

    private function parseUrl(string $url): ?ParsedMaterialContentViewModel
    {
        $baseHost = parse_url(app(UUCourseClient::class)->currentBaseUrl(), PHP_URL_HOST);

        if (! is_string($baseHost) || trim($baseHost) === '') {
            $baseHost = parse_url($url, PHP_URL_HOST);
        }

        if (! is_string($baseHost) || trim($baseHost) === '') {
            return null;
        }

        return ParsedMaterialContentViewModel::fromResult(app(ParseMaterialContent::class)($url, $baseHost));
    }

    /**
     * Keeps the content and the values derived from it (computed once, not on
     * every 1 s render).
     */
    private function applyContent(?ParsedMaterialContentViewModel $content): void
    {
        $this->content = $content;
        $this->html = trim((string) $content?->htmlContent);
        $this->subtitleUrl = $content?->subtitleUrl;
        $this->downloadUrl = $content?->downloadUrl;
    }

    private function needsCellularPrompt(): bool
    {
        if (! $this->hasNativePlayer() && ! $this->isYoutube()) {
            return false;
        }

        try {
            if (! app(GetCellularPlaybackWarningEnabled::class)()) {
                return false;
            }

            $status = Network::status();
        } catch (Throwable) {
            return false;
        }

        return ($status->type ?? null) === 'cellular';
    }

    private function prepareMedia(): void
    {
        if ($this->isYoutube()) {
            return;
        }

        if (! $this->hasNativePlayer()) {
            return;
        }

        if ($this->nativeRestored) {
            $this->nativeRestored = false;
            $this->mediaReady = true;

            return;
        }

        $position = $this->savedPosition();

        if ($position >= self::MIN_RESUME_SECONDS) {
            $this->resumePrompt = ['position' => $position, 'label' => MaterialUrls::secondsLabel($position)];

            return;
        }

        $this->mediaReady = true;
    }

    private function savedPosition(): float
    {
        try {
            $progress = app(GetPlaybackProgress::class)($this->cid, $this->activeNodeIdentifier);
        } catch (Throwable $exception) {
            report($exception);

            return 0.0;
        }

        return $progress !== null && is_finite($progress->positionSeconds) ? $progress->positionSeconds : 0.0;
    }

    private function restoreNativeState(): void
    {
        $session = ActiveMediaSession::find();

        if ($session === null) {
            return;
        }

        if (
            $session['routePath'] !== $this->materialRoute($this->activeNodeIdentifier)
            || $session['activityId'] !== $this->activeNodeIdentifier
            || $session['cid'] !== $this->cid
            || $session['startedAt'] === null
        ) {
            return;
        }

        $this->restoredStartedAt = $session['startedAt'];
        $this->nativeRestored = true;
    }

    private function materialRoute(string $identifier): string
    {
        return $this->route('native.courses.material.show', ['cid' => $this->cid, 'scoid' => $identifier]);
    }

    private function currentPlaybackRate(): float
    {
        try {
            $rate = MediaPlayer::getPlaybackRate();
        } catch (Throwable) {
            return 1.0;
        }

        return $rate >= 0.5 && $rate <= 3.0 ? $rate : 1.0;
    }

    // ---- prompts ---------------------------------------------------------

    public function confirmResume(): void
    {
        $position = $this->resumePrompt['position'] ?? 0.0;

        $this->resumePrompt = null;
        $this->mediaStart = $position;
        $this->mediaAutoplay = true;
        $this->mediaReady = true;
    }

    public function declineResume(): void
    {
        if ($this->resumePrompt === null) {
            return;
        }

        $this->resumePrompt = null;
        $this->mediaStart = 0.0;
        $this->mediaAutoplay = true;
        $this->mediaReady = true;
    }

    public function continueOnCellular(): void
    {
        $this->settleCellularPrompt();
        $this->beginTracking();
        $this->prepareMedia();
    }

    public function declineCellular(): void
    {
        $this->settleCellularPrompt();
        $this->timerClosed = true;
        $this->back();
    }

    private function settleCellularPrompt(): void
    {
        $this->cellularPromptVisible = false;

        if (! $this->cellularDontAsk) {
            return;
        }

        try {
            app(SetCellularPlaybackWarningEnabled::class)(new SetCellularPlaybackWarningEnabledInputData(false));
        } catch (Throwable $exception) {
            // The user is simply asked again next time.
            report($exception);
        }
    }

    // ---- navigation between nodes ---------------------------------------

    /**
     * Asks to switch to another node. The switch itself runs from the next
     * `tick()` so the saving overlay is painted before the (synchronous)
     * study time upload.
     */
    public function selectNode(string $identifier, ?string $href = null): void
    {
        if ($identifier === '' || $identifier === $this->activeNodeIdentifier || $this->saving) {
            return;
        }

        $this->saving = true;
        $this->pendingNode = $identifier;
    }

    public function goToPrevious(): void
    {
        $node = $this->previousNode();

        if ($node !== null) {
            $this->selectNode($node->identifier);
        }
    }

    public function goToNext(): void
    {
        $node = $this->nextNode();

        if ($node !== null) {
            $this->selectNode($node->identifier);
        }
    }

    private function completeNodeSwitch(): void
    {
        $target = (string) $this->pendingNode;
        $this->pendingNode = null;

        if (! $this->timerClosed && ! $this->saveStudyTime()) {
            if ($this->sessionLostWhileSaving && $this->sessionExpired()) {
                $this->saving = false;

                return;
            }

            $this->toastError('學習進度儲存失敗');
        }

        $this->segmentStartedAt = null;
        $this->displayStartedAt = null;
        $this->timerClosed = false;
        $this->saving = false;
        $this->activeNodeIdentifier = $target;
        $this->restoredStartedAt = null;
        $this->nativeRestored = false;

        $this->openNode();
    }

    /**
     * @return array<int, CourseMaterialNodeViewModel>
     */
    private function navigableNodes(): array
    {
        return array_values(array_filter(
            $this->materialNodes,
            fn (CourseMaterialNodeViewModel $node): bool => $node->leaf && ($node->href ?? '') !== '' && ! $node->itemDisabled,
        ));
    }

    public function previousNode(): ?CourseMaterialNodeViewModel
    {
        $index = $this->activeNavigationIndex();

        return $index > 0 ? $this->navigableNodes()[$index - 1] : null;
    }

    public function nextNode(): ?CourseMaterialNodeViewModel
    {
        $index = $this->activeNavigationIndex();
        $nodes = $this->navigableNodes();

        return $index >= 0 && $index < count($nodes) - 1 ? $nodes[$index + 1] : null;
    }

    private function activeNavigationIndex(): int
    {
        foreach ($this->navigableNodes() as $index => $node) {
            if ($node->identifier === $this->activeNodeIdentifier) {
                return $index;
            }
        }

        return -1;
    }

    public function activeNode(): ?CourseMaterialNodeViewModel
    {
        foreach ($this->materialNodes as $node) {
            if ($node->identifier === $this->activeNodeIdentifier) {
                return $node;
            }
        }

        return null;
    }

    // ---- back handling ---------------------------------------------------

    /**
     * Every back gesture ends here: Android's system back, and on iOS the
     * edge swipe and the nav-bar chevron (the native stack pops first, then
     * reports the pop). The study time is saved before leaving.
     */
    public function onBackPressed(): void
    {
        try {
            $this->closeTimer();
        } catch (Throwable $exception) {
            report($exception);
        }

        $this->back();
    }

    /**
     * Safety net for every other way off the screen (replace, shutdown). The
     * save runs before the children unmount so the player position can still
     * be read; no overlay is possible here.
     */
    public function unmount(): void
    {
        try {
            $this->closeTimer();
        } catch (Throwable $exception) {
            report($exception);
        } finally {
            parent::unmount();
        }
    }

    // ---- links from the article -----------------------------------------

    public function openNodeLink(string $identifier, string $url): void
    {
        if ($identifier === $this->activeNodeIdentifier) {
            $this->openNode(startTimer: false);

            return;
        }

        $this->selectNode($identifier);
    }

    public function loadSubpage(string $url): void
    {
        $baseUrl = app(UUCourseClient::class)->currentBaseUrl();

        if (! MaterialUrls::sameHost($url, $baseUrl)) {
            Browser::inApp($url);

            return;
        }

        $this->loading = true;
        $this->error = '';
        $this->errorDetail = [];

        try {
            $content = $this->parseUrl($url);

            if ($content === null) {
                throw new \RuntimeException('沒有可用的教材網址');
            }

            $this->applyContent($content);
            $this->contentUrl = $url;
            $this->mediaReady = $this->hasNativePlayer();
            $this->mediaStart = 0.0;
            $this->resumePrompt = null;
        } catch (Throwable $exception) {
            report($exception);

            if (! $this->sessionExpired()) {
                $this->applyContent(null);
                $this->error = $this->failureMessage($exception, '載入教材內容失敗');
                $this->errorDetail = $this->failureDetail($exception, '教材內容');
            }
        }

        $this->loading = false;
    }

    public function openTronclass(string $url): void
    {
        TronclassLink::open($url);
    }

    public function openExternal(string $url): void
    {
        Browser::inApp($url);
    }

    public function openSystem(string $url): void
    {
        Browser::open($url);
    }

    public function openInAppBrowser(): void
    {
        $href = $this->activeNode()?->href;

        if ($href === null || $href === '') {
            return;
        }

        if (AttachmentBridge::openUrl($href, $this->hunguCookies()) === null) {
            Browser::inApp($href);
        }
    }

    // ---- media events ----------------------------------------------------

    public function onPlaybackProgress(float $currentTime, ?float $duration, string $state): void
    {
        $this->rememberPlayback($currentTime, $duration);
        $this->playerError = '';
    }

    public function onYoutubeProgress(?float $currentTime, ?float $duration): void
    {
        $this->rememberPlayback($currentTime, $duration);
    }

    public function onPlayerError(string $message, ?int $code = null): void
    {
        $this->playerError = $message;
    }

    private function rememberPlayback(?float $currentTime, ?float $duration): void
    {
        if ($currentTime !== null && $currentTime >= 0) {
            $this->lastPosition = $currentTime;
        }

        if ($duration !== null && $duration > 0) {
            $this->lastDuration = $duration;
        }
    }

    public function reloadContent(): void
    {
        if ($this->reloading) {
            return;
        }

        $this->reloading = true;
        $this->reloadError = '';

        $position = $this->hasNativePlayer() ? MediaPlayer::getCurrentTime() : 0.0;

        try {
            $this->resources = app(GetNodeResources::class)($this->cid, $this->activeNodeIdentifier)->items();
            $this->applyContent($this->parseNode());
        } catch (Throwable $exception) {
            report($exception);
            $this->reloadError = $this->sessionExpired() ? '' : '重新載入失敗，請稍後再試。';
        }

        if ($this->hasNativePlayer() && $this->mediaReady && $position > 0) {
            // The player reloads when the refreshed URL differs (`start` is applied to the new source).
            $this->mediaStart = $position;
            $this->mediaAutoplay = true;
        }

        $this->reloading = false;
    }

    public function captureFrame(): void
    {
        if ($this->capturing) {
            return;
        }

        $this->captureError = '';

        if ($this->studentId === '') {
            $this->captureError = '找不到目前的帳號，無法產生截圖。';

            return;
        }

        $this->capturing = true;

        try {
            $result = MediaPlayer::captureFrame();
        } catch (Throwable) {
            $result = null;
        }

        if ($result === null) {
            $this->captureError = '截圖失敗，請稍後再試。';
        }

        $this->capturing = false;
    }

    // ---- font scale ------------------------------------------------------

    public function zoomOut(): void
    {
        $this->setFontScale($this->fontScale - self::FONT_SCALE_STEP);
    }

    public function zoomIn(): void
    {
        $this->setFontScale($this->fontScale + self::FONT_SCALE_STEP);
    }

    public function resetZoom(): void
    {
        $this->setFontScale(1.0);
    }

    private function setFontScale(float $scale): void
    {
        $scale = round(min(self::FONT_SCALE_MAX, max(self::FONT_SCALE_MIN, $scale)), 2);

        if (abs($scale - $this->fontScale) < 0.001) {
            return;
        }

        $this->fontScale = $scale;

        try {
            app(SetMaterialFontScale::class)(new SetMaterialFontScaleInputData($scale));
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    public function canZoomOut(): bool
    {
        return $this->fontScale > self::FONT_SCALE_MIN + 0.000001;
    }

    public function canZoomIn(): bool
    {
        return $this->fontScale < self::FONT_SCALE_MAX - 0.000001;
    }

    public function scaleLabel(): string
    {
        return round($this->fontScale * 100).'%';
    }

    // ---- display helpers -------------------------------------------------

    public function navTitle(): string
    {
        return $this->courseTitle();
    }

    public function courseTitle(): string
    {
        $name = $this->course?->name;

        return $name !== null && $name !== '' ? $name : "課程 {$this->cid}";
    }

    public function activeNodeText(): string
    {
        return $this->activeNode()?->text ?? '';
    }

    public function subtitle(): string
    {
        $text = $this->activeNodeText();

        return $text !== '' ? $text : '檢視教材';
    }

    public function isAudioCourse(): bool
    {
        if ($this->course?->courseType !== '語音') {
            return false;
        }

        $text = $this->activeNodeText();

        return ! (str_contains($text, '錄影') && str_contains($text, '面授'));
    }

    public function isYoutube(): bool
    {
        return $this->content !== null
            && $this->content->videoProvider->value === 'youtube'
            && ($this->content->embedVideoUrl ?? '') !== '';
    }

    public function hasNativePlayer(): bool
    {
        return ! $this->isYoutube() && ($this->content->videoUrl ?? '') !== '';
    }

    public function hasHtml(): bool
    {
        return $this->html !== '';
    }

    public function hasDownload(): bool
    {
        return ($this->downloadUrl ?? '') !== '';
    }

    public function isEmpty(): bool
    {
        return ! $this->hasNativePlayer() && ! $this->isYoutube() && ! $this->hasHtml() && ! $this->hasDownload();
    }

    /**
     * Echoed by `MediaPlayer::getState()` so a restarted screen can restore
     * itself (see `ActiveMediaSession`). `startedAt` is the start of the
     * unsaved span, so a restored screen never re-sends saved time.
     *
     * @return array<string, string>|null
     */
    public function sessionContext(): ?array
    {
        $node = $this->activeNode();

        if ($node === null || ($node->href ?? '') === '' || $this->segmentStartedAt === null) {
            return null;
        }

        return [
            'routePath' => $this->materialRoute($node->identifier),
            'cid' => $this->cid,
            'activityId' => $node->identifier,
            'href' => (string) $node->href,
            'startedAt' => $this->segmentStartedAt,
        ];
    }

    public function downloadDescription(): string
    {
        if ($this->content?->isPdf ?? false) {
            return '本教材為 PDF 檔案，您可以下載後以其他 App 開啟或使用內建瀏覽器檢視。';
        }

        $extension = $this->content?->downloadFileExtension ?? '';

        return '本教材為可下載檔案'.($extension !== '' ? "（.{$extension}）" : '').'，請下載後以其他 App 開啟。';
    }

    public function canCaptureFrame(): bool
    {
        return $this->hasNativePlayer() && $this->mediaReady && ! $this->isAudioCourse();
    }

    public function downloadFilename(): string
    {
        return MaterialUrls::downloadFilename(
            $this->content?->downloadFileName,
            $this->content?->downloadFileExtension,
            $this->content?->isPdf ?? false,
            $this->activeNodeText(),
        );
    }

    /**
     * @return list<string>
     */
    public function resourceLabels(): array
    {
        $labels = [];

        foreach ($this->resources as $index => $resource) {
            $labels[] = $resource->filename ?: ($resource->title ?: ($resource->href ?: '資源 '.($index + 1)));
        }

        return $labels;
    }

    public function render(): View
    {
        return view('native.courses.material');
    }

    private function sessionExpired(): bool
    {
        if (! $this->handleSessionExpired()) {
            return false;
        }

        $this->timerSuspended = true;

        return true;
    }

    private function resolveAppearance(): string
    {
        try {
            $appearance = app(GetAppearance::class)();
        } catch (Throwable) {
            return 'auto';
        }

        return in_array($appearance, ['light', 'dark'], true) ? $appearance : 'auto';
    }

    private function resolveFontScale(): float
    {
        try {
            return app(GetMaterialFontScale::class)();
        } catch (Throwable) {
            return 1.0;
        }
    }

    private function resolveStudentId(): string
    {
        try {
            return (string) (app(GetSessionProfile::class)()->username ?? '');
        } catch (Throwable) {
            return '';
        }
    }
}
