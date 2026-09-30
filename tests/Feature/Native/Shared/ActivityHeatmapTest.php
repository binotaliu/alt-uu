<?php

declare(strict_types=1);

use App\NativeComponents\Support\ActivityHeatmapData;
use Tests\Feature\Native\Fixtures\RecordingHost;

it('maps study seconds to five intensity levels', function (): void {
    expect(array_map(ActivityHeatmapData::levelFor(...), [0, 1, 899, 900, 1799, 1800, 3599, 3600]))
        ->toBe([0, 1, 1, 2, 2, 3, 3, 4]);
});

it('lays days out in Sunday-first weeks padded with nulls', function (): void {
    $days = ActivityHeatmapData::normalize([
        ['date' => '2026-09-30', 'seconds' => 10],
        ['date' => '2026-10-01', 'seconds' => 0],
        ['date' => '2026-10-02', 'seconds' => 5],
    ]);

    $weeks = ActivityHeatmapData::weeks($days);

    expect($weeks)->toHaveCount(1)
        ->and($weeks[0])->toHaveCount(7)
        ->and($weeks[0][0])->toBeNull()
        ->and($weeks[0][3]['date'])->toBe('2026-09-30')
        ->and($weeks[0][6])->toBeNull()
        ->and(ActivityHeatmapData::monthLabelFor($weeks, 0))->toBe('9月');
});

it('finds streak boundaries and formats durations', function (): void {
    $days = ActivityHeatmapData::normalize([
        ['date' => '2026-09-25', 'seconds' => 5],
        ['date' => '2026-09-26', 'seconds' => 0],
        ['date' => '2026-09-27', 'seconds' => 5],
        ['date' => '2026-09-28', 'seconds' => 5],
        ['date' => '2026-09-29', 'seconds' => 5],
        ['date' => '2026-09-30', 'seconds' => 0],
    ]);

    expect(ActivityHeatmapData::longestStreakRange($days, 3))->toBe(['start' => '2026-09-27', 'end' => '2026-09-29'])
        ->and(ActivityHeatmapData::currentStreakStartDate($days, 3))->toBe('2026-09-27')
        ->and(ActivityHeatmapData::formatDuration(0))->toBe('無學習紀錄')
        ->and(ActivityHeatmapData::formatDuration(3900))->toBe('1 小時 5 分鐘')
        ->and(ActivityHeatmapData::formatDuration(1500))->toBe('25 分鐘')
        ->and(ActivityHeatmapData::formatDateSlash('2026-09-05'))->toBe('2026/9/5')
        ->and(ActivityHeatmapData::recentWeeks([[1], [2], [3]], 2))->toBe([[2], [3]]);
});

it('renders streak stats and the grid', function (): void {
    RecordingHost::mountView('activity-heatmap', ['streak' => 4])
        ->assertSee('目前連續')
        ->assertSee('4 天')
        ->assertSee('最長單日學習時間')
        ->assertSee('1 小時 6 分鐘')
        ->assertSee('2026/9/30')
        ->assertSee('點選方格以檢視當日學習時間')
        ->assertElement('scroll_view');
});

it('shows the date and duration of a tapped cell', function (): void {
    RecordingHost::mountView('activity-heatmap')
        ->tap('cell-2026-09-27')
        ->assertSee('2026年9月27日・10 分鐘')
        ->tap('cell-2026-09-27')
        ->assertSee('點選方格以檢視當日學習時間');
});

it('colours cells with one distinct fill per intensity level', function (): void {
    $fills = [];
    $walk = function (array $node) use (&$walk, &$fills): void {
        if (($node['type'] ?? null) === 'rect' && isset($node['style']['bg_color'])) {
            $fills[$node['style']['bg_color']] = true;
        }

        foreach ($node['children'] ?? [] as $child) {
            $walk($child);
        }
    };

    $walk(RecordingHost::mountView('activity-heatmap')->tree());

    expect($fills)->toHaveCount(5);
});
