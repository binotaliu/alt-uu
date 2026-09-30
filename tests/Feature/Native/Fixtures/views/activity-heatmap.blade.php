@php
    use AltUU\Domains\Activity\ViewModels\ActivityDayViewModel as Day;
    $days = [
        new Day('2026-09-26', 0),
        new Day('2026-09-27', 600),
        new Day('2026-09-28', 1000),
        new Day('2026-09-29', 2000),
        new Day('2026-09-30', 4000),
        new Day('2026-10-01', 0),
    ];
@endphp

<native:activity-heatmap
    key="heatmap"
    :days="$days"
    :current-streak="$state['streak'] ?? 0"
    :longest-streak="4"
    :longest-study-day-seconds="4000"
    longest-study-day-date="2026-09-30"
    :visible-weeks="$state['weeks'] ?? 20"
/>
