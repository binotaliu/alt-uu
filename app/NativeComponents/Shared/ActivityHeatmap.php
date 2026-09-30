<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use App\NativeComponents\Support\ActivityHeatmapData;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Traversable;

/**
 * Study-time heatmap with streak summary (ActivityHeatmap.vue).
 *
 * Tag: `<native:activity-heatmap key="heatmap" :days="$heatmap->days" :current-streak="$heatmap->currentStreak" :longest-streak="$heatmap->longestStreak" :longest-study-day-seconds="$heatmap->longestStudyDaySeconds" :longest-study-day-date="$heatmap->longestStudyDayDate" />`
 * (values from GetActivityHeatmap's ActivityHeatmapViewModel).
 *
 * Props: `days` (ActivityDayViewModel[] or `['date','seconds']` arrays, oldest
 * first), `currentStreak`, `longestStreak`, `longestStudyDaySeconds`,
 * `longestStudyDayDate`, `visibleWeeks` (how many of the most recent week
 * columns to draw, default 20, 0 = all inside a horizontal scroll view).
 * No events. Tapping a cell shows its date and duration under the grid (the
 * web version used a hover title).
 *
 * Gap: `native:scroll-view` cannot be told to start scrolled to the end from
 * Blade (only the programmatic `autoScrollTo()` exists), so the Vue "scroll to
 * latest" behaviour is replaced by showing only the latest `visibleWeeks`.
 */
final class ActivityHeatmap extends NativeComponent
{
    /** @var array<int, mixed>|Traversable<int, mixed> */
    public array|Traversable $days = [];

    public int $currentStreak = 0;

    public int $longestStreak = 0;

    public int $longestStudyDaySeconds = 0;

    public ?string $longestStudyDayDate = null;

    public int $visibleWeeks = 20;

    public string $selectedDate = '';

    public function select(string $date): void
    {
        $this->selectedDate = $this->selectedDate === $date ? '' : $date;
    }

    public function render(): View
    {
        $days = ActivityHeatmapData::normalize($this->days);
        $weeks = ActivityHeatmapData::recentWeeks(ActivityHeatmapData::weeks($days), $this->visibleWeeks);

        $selected = null;

        foreach ($days as $day) {
            if ($day['date'] === $this->selectedDate) {
                $selected = ActivityHeatmapData::formatDate($day['date']).'・'.ActivityHeatmapData::formatDuration($day['seconds']);
            }
        }

        $longestRange = ActivityHeatmapData::longestStreakRange($days, $this->longestStreak);
        $currentStart = ActivityHeatmapData::currentStreakStartDate($days, $this->currentStreak);

        return view('native.shared.activity-heatmap', [
            'weeks' => $weeks,
            'monthLabels' => array_map(
                static fn (int $index): string => ActivityHeatmapData::monthLabelFor($weeks, $index),
                array_keys($weeks),
            ),
            'weekdayLabels' => ['', '一', '', '三', '', '五', ''],
            'selectedCaption' => $selected,
            'currentStartLabel' => $currentStart !== null ? ActivityHeatmapData::formatDateSlash($currentStart).' ~' : '—',
            'longestRangeLabel' => $longestRange === null
                ? '—'
                : ActivityHeatmapData::formatDateSlash($longestRange['start'])
                    .($longestRange['start'] !== $longestRange['end'] ? ' ~ '.ActivityHeatmapData::formatDateSlash($longestRange['end']) : ''),
            'longestDayLabel' => $this->longestStudyDaySeconds > 0 ? ActivityHeatmapData::formatDuration($this->longestStudyDaySeconds) : '—',
            'longestDayDateLabel' => $this->longestStudyDayDate !== null ? ActivityHeatmapData::formatDateSlash($this->longestStudyDayDate) : '',
            'levelClasses' => [
                'bg-theme-surface-variant',
                'bg-theme-primary/20',
                'bg-theme-primary/40',
                'bg-theme-primary/70',
                'bg-theme-primary',
            ],
            'levelFor' => ActivityHeatmapData::levelFor(...),
        ]);
    }
}
