<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses;

use AltUU\Domains\AppPreference\Actions\GetNouToolsIntegrationEnabled;
use AltUU\Domains\Course\Actions\GetCourseHomeworks;
use AltUU\Domains\Course\Actions\GetCourseLearningTimeItems;
use AltUU\Domains\Course\Actions\GetCourseSelfExams;
use AltUU\Domains\Course\Actions\GetCourseTasksCount;
use AltUU\Domains\Course\Actions\GetNouToolsCourseData;
use AltUU\Domains\Course\Actions\ListCourses;
use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use AltUU\Domains\Discuss\Actions\ListBoards;
use AltUU\Domains\SchoolPortal\Actions\GetCourseClassSessionInfo;
use AltUU\Domains\SchoolPortal\Actions\GetCourseExamInfo;
use AltUU\Domains\SchoolPortal\Actions\GetCourseSemesterGrade;
use AltUU\Domains\SchoolPortal\Actions\GetSchoolPortalHomeworkNotices;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalClassSessionInfoViewModel;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalExamInfoViewModel;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalGradeViewModel;
use AltUU\Domains\StudyTime\Actions\GetLastSeenMaterial;
use App\NativeComponents\Concerns\GuardsHunguSession;
use App\NativeComponents\Concerns\ShowsSessionExpiredPicker;
use App\NativeComponents\Concerns\ShowsToasts;
use App\NativeComponents\Courses\Concerns\DescribesLoadFailures;
use App\NativeComponents\Support\CourseListing;
use Closure;
use Illuminate\View\View;
use Native\Mobile\Attributes\Lazy;
use Native\Mobile\Edge\NativeComponent;
use Throwable;

/**
 * Native port of pages/Courses/Show.vue: a course with six tabs.
 *
 * Route data: `tab` (materials, discuss, homework, self-exam, grades,
 * course-info; anything else, including the legacy `study-time`, opens
 * materials). The screen owns all loading, errors and the session guard; the
 * tab children (`CourseMaterialsTab`, `CourseDiscussTab`, ...) are
 * presentational and emit `retry` / `browser-opened` back.
 *
 * Loading policy mirrors the Vue watchers: materials and the board list load
 * once when first shown, homework / self-exam / grades / course info reload
 * every time their tab is activated. All Actions run synchronously, so no
 * skeleton can paint while an upstream call is in flight; `#[Lazy]` paints
 * `course-show-placeholder` instantly while `mount()` runs.
 */
#[Lazy]
final class CourseShow extends NativeComponent
{
    use DescribesLoadFailures;
    use GuardsHunguSession;
    use ShowsSessionExpiredPicker;
    use ShowsToasts;

    public const array TABS = [
        'materials' => '教材',
        'discuss' => '討論',
        'homework' => '作業',
        'self-exam' => '練習',
        'grades' => '成績',
        'course-info' => '課程資訊',
    ];

    public string $cid = '';

    public string $activeTab = 'materials';

    public ?CourseItemViewModel $course = null;

    public bool $refreshing = false;

    public int $pendingHomeworks = 0;

    public int $unreadArticles = 0;

    /** @var array<string, bool> */
    public array $tabLoading = [];

    /** @var array<string, string> */
    public array $tabErrors = [];

    /** @var array<string, array<string, mixed>> */
    public array $tabErrorDetails = [];

    /** @var array<string, bool> */
    public array $tabLoaded = [];

    /** @var array<int, mixed> */
    public array $learningTimeItems = [];

    public ?string $lastSeenIdentifier = null;

    public ?int $lastSeenPositionSeconds = null;

    public ?int $lastSeenDurationSeconds = null;

    /** @var list<array{courseId: string, title: string, boards: array<int, mixed>}> */
    public array $boardSections = [];

    /** @var array<int, mixed> */
    public array $homeworkItems = [];

    /** @var array<int, mixed> */
    public array $schoolPortalNotices = [];

    /** @var array<int, mixed> */
    public array $selfExamItems = [];

    public ?SchoolPortalGradeViewModel $grade = null;

    /** @var array<string, mixed>|null */
    public ?array $nouToolsCourse = null;

    public bool $nouToolsEnabled = false;

    public ?SchoolPortalClassSessionInfoViewModel $classSessionInfo = null;

    public ?SchoolPortalExamInfoViewModel $examInfo = null;

    public bool $refreshHomeworksOnReturn = false;

    public bool $refreshSelfExamsOnReturn = false;

    public function mount(): void
    {
        if (! $this->ensureHunguSession()) {
            return;
        }

        $this->cid = (string) $this->param('cid');
        $this->activeTab = self::normalizeTab($this->data('tab'));

        $this->loadCourse();
        $this->loadTasksCount();
        $this->loadTab($this->activeTab);
    }

    public static function normalizeTab(mixed $tab): string
    {
        return is_string($tab) && array_key_exists($tab, self::TABS) ? $tab : 'materials';
    }

    public function selectTab(string $tab): void
    {
        $tab = self::normalizeTab($tab);

        if ($tab === $this->activeTab) {
            return;
        }

        $this->activeTab = $tab;
        $this->loadTab($tab);
    }

    public function retryTab(string $tab): void
    {
        $this->loadTab(self::normalizeTab($tab), force: true);
    }

    /**
     * The in-app browser has no "closed" event on the PHP side, so a flag is
     * raised when a page is opened and honoured in `onResume()` and on the
     * next manual refresh.
     */
    public function markBrowserOpened(string $tab): void
    {
        if ($tab === 'homework') {
            $this->refreshHomeworksOnReturn = true;
        }

        if ($tab === 'self-exam') {
            $this->refreshSelfExamsOnReturn = true;
        }
    }

    public function refresh(): void
    {
        if ($this->refreshing || $this->handleSessionExpired()) {
            return;
        }

        $this->refreshing = true;
        $this->refreshHomeworksOnReturn = false;
        $this->refreshSelfExamsOnReturn = false;

        $this->loadCourse();
        $this->loadTasksCount();
        $this->loadTab($this->activeTab, force: true);

        $this->refreshing = false;
    }

    public function onResume(): void
    {
        if ($this->handleSessionExpired()) {
            return;
        }

        if ($this->refreshHomeworksOnReturn && $this->activeTab === 'homework') {
            $this->refreshHomeworksOnReturn = false;
            $this->loadTab('homework', force: true);
        }

        if ($this->refreshSelfExamsOnReturn && $this->activeTab === 'self-exam') {
            $this->refreshSelfExamsOnReturn = false;
            $this->loadTab('self-exam', force: true);
        }
    }

    protected function onAccountSwitched(int $accountId): void
    {
        $this->replace($this->route('native.courses.index'));
    }

    public function navTitle(): string
    {
        return $this->courseTitle();
    }

    public function courseTitle(): string
    {
        $name = $this->course?->name;

        return $name !== null && $name !== '' ? $name : "課程 {$this->cid}";
    }

    public function courseSubtitle(): string
    {
        if ($this->course === null) {
            return '';
        }

        return implode(' · ', array_filter([
            $this->course->semester,
            $this->course->courseType,
            $this->course->className,
        ], static fn (?string $part): bool => $part !== null && $part !== ''));
    }

    public function badgeFor(string $tab): string
    {
        $count = match ($tab) {
            'discuss' => $this->unreadArticles,
            'homework' => $this->pendingHomeworks,
            default => 0,
        };

        if ($count <= 0) {
            return '';
        }

        return $count > 99 ? '99+' : (string) $count;
    }

    public function placeholder(): View
    {
        return view('native.courses.course-show-placeholder');
    }

    public function render(): View
    {
        return view('native.courses.course-show');
    }

    private function loadCourse(): void
    {
        try {
            $this->course = collect(app(ListCourses::class)()->items())
                ->first(fn (CourseItemViewModel $item): bool => $item->courseId === $this->cid);
        } catch (Throwable $exception) {
            report($exception);
            $this->handleSessionExpired();
        }
    }

    private function loadTasksCount(): void
    {
        try {
            $counts = [];

            foreach (app(GetCourseTasksCount::class)()->items() as $item) {
                $counts[$item->courseId] = $item;
            }

            $tasks = $this->course !== null
                ? CourseListing::tasksFor($this->course, $counts)
                : CourseListing::tasksFor(new CourseItemViewModel(courseId: $this->cid), $counts);

            $this->pendingHomeworks = $tasks['pendingHomeworks'];
            $this->unreadArticles = $tasks['unreadArticles'];
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    private function loadTab(string $tab, bool $force = false): void
    {
        $alwaysReload = in_array($tab, ['homework', 'self-exam', 'grades', 'course-info'], true);

        if (! $force && ! $alwaysReload && ($this->tabLoaded[$tab] ?? false)) {
            return;
        }

        match ($tab) {
            'materials' => $this->loadMaterials(),
            'discuss' => $this->loadBoardSections(),
            'homework' => $this->loadHomeworks(),
            'self-exam' => $this->loadSelfExams(),
            'grades' => $this->loadGrade(),
            default => $this->loadCourseInfo(),
        };
    }

    /**
     * Runs one tab's loader, recording loading / error state. A failure first
     * asks the session guard whether the session is gone (picker or redirect)
     * and only otherwise shows the inline retry card.
     */
    private function attempt(string $tab, string $fallbackMessage, string $operationLabel, Closure $load): void
    {
        $this->tabLoading[$tab] = true;
        $this->tabErrors[$tab] = '';
        $this->tabErrorDetails[$tab] = [];

        try {
            $load();
            $this->tabLoaded[$tab] = true;
        } catch (Throwable $exception) {
            report($exception);

            if ($this->handleSessionExpired()) {
                return;
            }

            $this->tabErrors[$tab] = $this->failureMessage($exception, $fallbackMessage);
            $this->tabErrorDetails[$tab] = $this->failureDetail($exception, $operationLabel);
        } finally {
            $this->tabLoading[$tab] = false;
        }
    }

    private function loadMaterials(): void
    {
        $this->attempt('materials', '載入學習時間失敗', '教材目錄', function (): void {
            app(SyncCurrentCourse::class)($this->cid);
            $this->learningTimeItems = app(GetCourseLearningTimeItems::class)($this->cid)->items();

            try {
                $lastSeen = app(GetLastSeenMaterial::class)($this->cid);
                $this->lastSeenIdentifier = $lastSeen->activityId;
                $this->lastSeenPositionSeconds = $lastSeen->positionSeconds !== null ? (int) round($lastSeen->positionSeconds) : null;
                $this->lastSeenDurationSeconds = $lastSeen->mediaDurationSeconds !== null ? (int) round($lastSeen->mediaDurationSeconds) : null;
            } catch (Throwable $exception) {
                report($exception);
            }
        });
    }

    private function loadBoardSections(): void
    {
        $this->attempt('discuss', '載入討論板失敗', '討論板', function (): void {
            $listBoards = app(ListBoards::class);
            $sections = [[
                'courseId' => $this->cid,
                'title' => trim((string) $this->course?->className) !== '' ? trim((string) $this->course?->className) : "課程 {$this->cid}",
                'boards' => $listBoards($this->cid)->boards,
            ]];

            if ($this->course?->commonCourseId !== null && $this->course->commonCourseId !== '') {
                $sections[] = [
                    'courseId' => $this->course->commonCourseId,
                    'title' => '共用版',
                    'boards' => $listBoards($this->course->commonCourseId)->boards,
                ];
            }

            $this->boardSections = $sections;
        });
    }

    private function loadHomeworks(): void
    {
        $this->refreshHomeworksOnReturn = false;

        $this->attempt('homework', '載入作業失敗', '作業', function (): void {
            app(SyncCurrentCourse::class)($this->cid, force: true);
            $this->homeworkItems = app(GetCourseHomeworks::class)()->items();
            $this->schoolPortalNotices = [];

            if ($this->course === null) {
                return;
            }

            try {
                $this->schoolPortalNotices = app(GetSchoolPortalHomeworkNotices::class)($this->course)->items();
            } catch (Throwable $exception) {
                // The school portal is a best-effort secondary source.
                report($exception);
            }
        });
    }

    private function loadSelfExams(): void
    {
        $this->refreshSelfExamsOnReturn = false;

        $this->attempt('self-exam', '載入自我練習失敗', '自我練習', function (): void {
            app(SyncCurrentCourse::class)($this->cid, force: true);
            $this->selfExamItems = app(GetCourseSelfExams::class)()->items();
        });
    }

    private function loadGrade(): void
    {
        $this->attempt('grades', '載入成績失敗', '成績', function (): void {
            $this->grade = null;

            if ($this->course === null) {
                return;
            }

            try {
                $this->grade = app(GetCourseSemesterGrade::class)($this->course);
            } catch (Throwable $exception) {
                report($exception);
            }
        });
    }

    private function loadCourseInfo(): void
    {
        $this->attempt('course-info', '載入課程資訊失敗', '課程資訊', function (): void {
            $this->nouToolsEnabled = app(GetNouToolsIntegrationEnabled::class)();
            $this->nouToolsCourse = $this->nouToolsEnabled ? $this->fetchNouToolsCourse() : null;
            $this->classSessionInfo = null;
            $this->examInfo = null;

            if ($this->course === null) {
                return;
            }

            try {
                $this->classSessionInfo = app(GetCourseClassSessionInfo::class)($this->course);
            } catch (Throwable $exception) {
                report($exception);
            }

            try {
                $this->examInfo = app(GetCourseExamInfo::class)($this->course);
            } catch (Throwable $exception) {
                report($exception);
            }
        });
    }

    /**
     * Same shaping as NouToolsCourseInfoController, without the HTTP hop.
     *
     * @return array<string, mixed>|null
     */
    private function fetchNouToolsCourse(): ?array
    {
        $courseData = app(GetNouToolsCourseData::class)(app(ListCourses::class)());
        $current = collect($courseData)->first(fn (array $item): bool => ($item['courseId'] ?? null) === $this->cid);

        if (! is_array($current) || ! isset($current['detail']) || ! is_array($current['detail'])) {
            return null;
        }

        $detail = $current['detail'];

        return [
            'courseId' => $current['courseId'],
            'courseName' => $current['name'],
            'className' => $current['className'],
            'creditType' => $detail['creditType'] ?? null,
            'credits' => $detail['credits'] ?? null,
            'department' => $detail['department'] ?? null,
            'nature' => $detail['nature'] ?? null,
            'midtermDate' => $detail['midtermDate'] ?? null,
            'finalDate' => $detail['finalDate'] ?? null,
            'examTimeStart' => $detail['examTimeStart'] ?? null,
            'examTimeEnd' => $detail['examTimeEnd'] ?? null,
            'textbook' => isset($detail['textbook']) && is_array($detail['textbook']) ? $detail['textbook'] : null,
            'previousExams' => isset($detail['previousExams']) && is_array($detail['previousExams'])
                ? array_values(array_filter($detail['previousExams'], 'is_array'))
                : [],
        ];
    }
}
