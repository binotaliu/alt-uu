<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses;

use AltUU\Domains\AppPreference\Actions\GetAppPreferences;
use AltUU\Domains\AppPreference\Actions\GetOnboardingCompleted;
use AltUU\Domains\Course\Actions\GetCourseTasksCount;
use AltUU\Domains\Course\Actions\ListCourses;
use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use App\NativeComponents\Concerns\GuardsHunguSession;
use App\NativeComponents\Concerns\ShowsSessionExpiredPicker;
use App\NativeComponents\Courses\Material\ActiveMediaSession;
use App\NativeComponents\Courses\Support\LoadFailure;
use App\NativeComponents\Support\CourseListing;
use App\NativeComponents\Support\ReleaseNotes;
use App\Services\NativeAccent;
use Illuminate\View\View;
use Native\Mobile\Attributes\Lazy;
use Native\Mobile\Edge\NativeComponent;
use Throwable;

/**
 * "我的課程" tab (CoursesPane.vue + CourseListTab.vue) and the main shell boot
 * (MainScreen.vue): session check, preferences, What's New sheet, app status
 * banners. Courses are grouped by semester; the per-course counters load in a
 * second step so a slow or failing tasks page never hides the list.
 *
 * It is also the app's start screen (`nativephp.start_url`): a first launch
 * is sent to onboarding, and the session guard sends a missing or dead
 * account to login / reauth.
 *
 * `restoreActiveMediaRoute`: when PHP restarted under a still-running native
 * player, mount() pushes the material screen of that session instead of
 * loading the list (which reloads on resume once the user comes back).
 */
#[Lazy]
final class CourseList extends NativeComponent
{
    use GuardsHunguSession;
    use ShowsSessionExpiredPicker;

    /** @var list<CourseItemViewModel> */
    public array $courses = [];

    /** @var array<string, array{pendingHomeworks: int, unreadArticles: int}> */
    public array $tasksCount = [];

    public bool $loading = true;

    public bool $tasksLoading = false;

    public bool $tasksError = false;

    public string $error = '';

    /** @var array<string, mixed> */
    public array $errorDetail = [];

    public bool $whatsNewVisible = false;

    public function navTitle(): string
    {
        return '我的課程';
    }

    public function placeholder(): View
    {
        return view('native.courses.course-list-placeholder');
    }

    public function mount(): void
    {
        // This is the start screen: a first launch goes through onboarding
        // (which continues to login or back here) before anything else.
        if (! app(GetOnboardingCompleted::class)()) {
            $this->replace($this->route('native.onboarding'));

            return;
        }

        // The equivalent of /api/bootstrap-session: once per app start.
        if (! $this->ensureHunguSession(validateRemotely: true)) {
            return;
        }

        $this->bootShell();

        if ($this->restoreActiveMediaSession()) {
            return;
        }

        $this->loadCourses();
        $this->loadTasksCount();
    }

    public function onResume(): void
    {
        if ($this->handleSessionExpired()) {
            return;
        }

        if ($this->courses === []) {
            $this->loadCourses();
        }

        $this->loadTasksCount();
    }

    public function refresh(): void
    {
        $this->retry();
    }

    public function retry(): void
    {
        $this->loadCourses();
        $this->loadTasksCount();
    }

    public function closeWhatsNew(): void
    {
        $this->whatsNewVisible = false;
    }

    public function onAccountSwitched(int $accountId): void
    {
        $this->courses = [];
        $this->tasksCount = [];
        $this->retry();
    }

    private function restoreActiveMediaSession(): bool
    {
        $session = ActiveMediaSession::find();

        if ($session === null) {
            return false;
        }

        $this->navigate($this->route('native.courses.material.show', ['cid' => $session['cid'], 'scoid' => $session['activityId']]));

        return true;
    }

    private function bootShell(): void
    {
        try {
            $preferences = app(GetAppPreferences::class)();

            app(NativeAccent::class)->apply($preferences->accentColor);

            // Brand-new installs finish onboarding first, which records the
            // current version as seen, so only upgrading users land here.
            $this->whatsNewVisible = $preferences->onboardingCompleted
                && ReleaseNotes::hasUnseen((string) config('nativephp.version'), $preferences->whatsNewSeenVersion);
        } catch (Throwable) {
            // Boot extras must never block the list.
        }
    }

    private function loadCourses(): void
    {
        $this->loading = true;
        $this->error = '';
        $this->errorDetail = [];

        try {
            $this->courses = array_values(app(ListCourses::class)()->items());
        } catch (Throwable $exception) {
            $this->courses = [];

            if ($this->handleSessionExpired()) {
                $this->loading = false;

                return;
            }

            ['message' => $this->error, 'detail' => $this->errorDetail] = LoadFailure::describe($exception);
        }

        $this->loading = false;
    }

    private function loadTasksCount(): void
    {
        $this->tasksLoading = true;
        $this->tasksError = false;

        try {
            $counts = [];

            foreach (app(GetCourseTasksCount::class)() as $entry) {
                $counts[$entry->courseId] = [
                    'pendingHomeworks' => $entry->pendingHomeworks,
                    'unreadArticles' => $entry->unreadArticles,
                ];
            }

            $this->tasksCount = $counts;
        } catch (Throwable) {
            $this->tasksError = true;
        }

        $this->tasksLoading = false;
    }

    public function render(): View
    {
        $groups = [];

        foreach (CourseListing::groupBySemester($this->courses) as $semester => $courses) {
            $semester = (string) $semester;
            foreach ($courses as $course) {
                $groups[$semester][] = [
                    'course' => $course,
                    ...CourseListing::tasksFor($course, $this->tasksCount),
                ];
            }
        }

        return view('native.courses.course-list', ['semesterGroups' => $groups]);
    }
}
