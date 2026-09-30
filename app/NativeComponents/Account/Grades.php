<?php

declare(strict_types=1);

namespace App\NativeComponents\Account;

use AltUU\Domains\SchoolPortal\Actions\GetAllCourseGrades;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalGradeViewModel;
use App\NativeComponents\Concerns\GuardsHunguSession;
use App\NativeComponents\Concerns\ShowsSessionExpiredPicker;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * All-semester course grades from the school portal (Account/Grades.vue),
 * grouped into consecutive semester sections. A semester grade of 60 or more
 * is green, a lower number red, and non-numeric text such as 無資料 stays
 * neutral (the SPA painted it red).
 *
 * Failures render the shared error card with a retry: an offline device gets
 * the connectivity message, an expired upstream session (HTTP 401) opens the
 * session picker / reauth flow instead.
 */
final class Grades extends NativeComponent
{
    use GuardsHunguSession;
    use ShowsSessionExpiredPicker;

    private const int PASSING_SCORE = 60;

    /** @var array<int, SchoolPortalGradeViewModel> */
    public array $grades = [];

    public bool $loading = true;

    public string $error = '';

    public function navTitle(): string
    {
        return '我的成績';
    }

    public function mount(): void
    {
        if (! $this->ensureHunguSession()) {
            return;
        }

        $this->loadGrades();
    }

    public function onResume(): void
    {
        $this->handleSessionExpired();
    }

    public function loadGrades(): void
    {
        $this->loading = true;
        $this->error = '';

        try {
            $this->grades = app(GetAllCourseGrades::class)();
        } catch (Throwable $exception) {
            $this->grades = [];

            if ($exception instanceof HttpExceptionInterface && $exception->getStatusCode() === 401 && $this->handleSessionExpired()) {
                return;
            }

            $this->error = $exception instanceof ConnectionException
                ? '外部服務暫時無法連線，請稍後再試。'
                : '載入成績失敗';
        } finally {
            $this->loading = false;
        }
    }

    protected function onAccountSwitched(int $accountId): void
    {
        $this->loadGrades();
    }

    /**
     * @return array<int, array{semesterLabel: string, grades: array<int, SchoolPortalGradeViewModel>}>
     */
    public function semesterGroups(): array
    {
        $groups = [];

        foreach ($this->grades as $grade) {
            $last = array_key_last($groups);

            if ($last !== null && $groups[$last]['semesterLabel'] === $grade->semesterLabel) {
                $groups[$last]['grades'][] = $grade;

                continue;
            }

            $groups[] = ['semesterLabel' => $grade->semesterLabel, 'grades' => [$grade]];
        }

        return $groups;
    }

    /**
     * @return array<int, array{label: string, value: string}>
     */
    public static function detailItems(SchoolPortalGradeViewModel $grade): array
    {
        return self::presentItems([
            '學分數' => $grade->credits,
            '平時成績' => $grade->regularAverage,
            '期中成績' => $grade->midtermScore,
            '期末成績' => $grade->finalScore,
        ]);
    }

    public static function isScorePassing(?string $score): bool
    {
        return $score !== null && is_numeric($score) && (int) $score >= self::PASSING_SCORE;
    }

    public function render(): View
    {
        return view('native.account.grades', [
            'groups' => $this->semesterGroups(),
            'returnTo' => $this->route('native.courses.account.grades'),
        ]);
    }

    /**
     * @param  array<string, ?string>  $items
     * @return array<int, array{label: string, value: string}>
     */
    private static function presentItems(array $items): array
    {
        $present = [];

        foreach ($items as $label => $value) {
            if ($value !== null) {
                $present[] = ['label' => $label, 'value' => $value];
            }
        }

        return $present;
    }
}
