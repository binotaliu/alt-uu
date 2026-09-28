<?php

declare(strict_types=1);

namespace AltUU\Domains\Activity\Actions;

use AltUU\Domains\Activity\ViewModels\ActivityDayViewModel;
use AltUU\Domains\Activity\ViewModels\ActivityHeatmapViewModel;
use App\Models\Account;
use App\Models\AccountDailyActivity;
use App\Services\AccountContext;
use Illuminate\Support\Facades\Date;

final readonly class GetActivityHeatmap
{
    private const int RANGE_MONTHS = 6;

    public function __construct(private AccountContext $accountContext) {}

    public function __invoke(bool $allAccounts = false): ActivityHeatmapViewModel
    {
        $accountId = $this->accountContext->currentAccountId();
        $today = Date::now('Asia/Taipei')->startOfDay();
        $rangeStart = $today->clone()->subMonths(self::RANGE_MONTHS)->addDay();

        $hasMultipleAccounts = Account::query()->count() > 1;
        $useAllAccounts = $allAccounts && $hasMultipleAccounts;

        $secondsByDate = ! $useAllAccounts && $accountId === null
            ? []
            : $this->fetchSecondsByDate(
                $useAllAccounts ? null : $accountId,
                $rangeStart->toDateString(),
                $today->toDateString(),
            );

        $days = [];
        $cursor = $rangeStart;

        while ($cursor->lte($today)) {
            $date = $cursor->toDateString();
            $days[] = new ActivityDayViewModel(
                date: $date,
                seconds: $secondsByDate[$date] ?? 0,
            );
            $cursor = $cursor->addDay();
        }

        $longestStudyDay = $this->findLongestStudyDay($days);

        return new ActivityHeatmapViewModel(
            days: $days,
            currentStreak: $this->calculateCurrentStreak($days),
            longestStreak: $this->calculateLongestStreak($days),
            longestStudyDayDate: $longestStudyDay?->date,
            longestStudyDaySeconds: $longestStudyDay?->seconds ?? 0,
            hasMultipleAccounts: $hasMultipleAccounts,
        );
    }

    /**
     * @return array<string, int>
     */
    private function fetchSecondsByDate(?int $accountId, string $rangeStart, string $rangeEnd): array
    {
        $query = AccountDailyActivity::query()
            ->whereBetween('activity_date', [$rangeStart, $rangeEnd]);

        if ($accountId !== null) {
            return $query->where('account_id', $accountId)
                ->pluck('total_seconds', 'activity_date')
                ->all();
        }

        return $query->selectRaw('activity_date, sum(total_seconds) as total_seconds')
            ->groupBy('activity_date')
            ->pluck('total_seconds', 'activity_date')
            ->map(static fn (mixed $seconds): int => (int) $seconds)
            ->all();
    }

    /**
     * @param  ActivityDayViewModel[]  $days
     */
    private function calculateCurrentStreak(array $days): int
    {
        $lastIndex = count($days) - 1;

        if ($lastIndex < 0) {
            return 0;
        }

        // Today may not have any activity yet without breaking the streak.
        $startIndex = $days[$lastIndex]->seconds > 0 ? $lastIndex : $lastIndex - 1;

        $streak = 0;

        for ($i = $startIndex; $i >= 0; $i--) {
            if ($days[$i]->seconds <= 0) {
                break;
            }

            $streak++;
        }

        return $streak;
    }

    /**
     * @param  ActivityDayViewModel[]  $days
     */
    private function calculateLongestStreak(array $days): int
    {
        $longest = 0;
        $current = 0;

        foreach ($days as $day) {
            if ($day->seconds > 0) {
                $current++;
                $longest = max($longest, $current);
            } else {
                $current = 0;
            }
        }

        return $longest;
    }

    /**
     * @param  ActivityDayViewModel[]  $days
     */
    private function findLongestStudyDay(array $days): ?ActivityDayViewModel
    {
        $longestDay = null;

        foreach ($days as $day) {
            if ($longestDay === null || $day->seconds > $longestDay->seconds) {
                $longestDay = $day;
            }
        }

        return $longestDay !== null && $longestDay->seconds > 0 ? $longestDay : null;
    }
}
