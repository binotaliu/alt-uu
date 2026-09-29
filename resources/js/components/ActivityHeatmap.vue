<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { ActivityDay } from '@/types';

const props = defineProps<{
    days: ActivityDay[];
    currentStreak: number;
    longestStreak: number;
    longestStudyDaySeconds: number;
    longestStudyDayDate: string | null;
}>();

const WEEKDAY_LABELS = ['', '一', '', '三', '', '五', ''];
const MONTH_LABELS = [
    '1月',
    '2月',
    '3月',
    '4月',
    '5月',
    '6月',
    '7月',
    '8月',
    '9月',
    '10月',
    '11月',
    '12月',
];

type Cell = { date: string; seconds: number } | null;

function levelFor(seconds: number): number {
    if (seconds <= 0) {
        return 0;
    }

    if (seconds < 900) {
        return 1;
    }

    if (seconds < 1800) {
        return 2;
    }

    if (seconds < 3600) {
        return 3;
    }

    return 4;
}

const LEVEL_CLASSES = [
    'bg-theme-100 dark:bg-zinc-800',
    'bg-theme-200 dark:bg-theme-900',
    'bg-theme-300 dark:bg-theme-800',
    'bg-theme-500 dark:bg-theme-600',
    'bg-theme-700 dark:bg-theme-400',
];

const weeks = computed<Cell[][]>(() => {
    if (props.days.length === 0) {
        return [];
    }

    const firstWeekday = new Date(`${props.days[0].date}T00:00:00`).getDay();

    const cells: Cell[] = [
        ...Array.from({ length: firstWeekday }, (): Cell => null),
        ...props.days.map(
            (day): Cell => ({ date: day.date, seconds: day.seconds }),
        ),
    ];

    while (cells.length % 7 !== 0) {
        cells.push(null);
    }

    const result: Cell[][] = [];

    for (let i = 0; i < cells.length; i += 7) {
        result.push(cells.slice(i, i + 7));
    }

    return result;
});

function monthLabelFor(weekIndex: number): string {
    const week = weeks.value[weekIndex];
    const firstCell = week.find((cell) => cell !== null);

    if (!firstCell) {
        return '';
    }

    const month = new Date(`${firstCell.date}T00:00:00`).getMonth();
    const previousWeek = weeks.value[weekIndex - 1];
    const previousCell = previousWeek?.find((cell) => cell !== null);
    const previousMonth = previousCell
        ? new Date(`${previousCell.date}T00:00:00`).getMonth()
        : null;

    return month !== previousMonth ? MONTH_LABELS[month] : '';
}

function formatDuration(seconds: number): string {
    if (seconds <= 0) {
        return '無學習紀錄';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours} 小時 ${minutes} 分鐘`;
    }

    return `${minutes} 分鐘`;
}

function formatDate(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

function formatDateSlash(date: string): string {
    const parsed = new Date(`${date}T00:00:00`);

    return `${parsed.getFullYear()}/${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

const currentStreakStartDate = computed<string | null>(() => {
    if (props.currentStreak <= 0 || props.days.length === 0) {
        return null;
    }

    let index = props.days.length - 1;

    if (props.days[index].seconds <= 0) {
        index -= 1;
    }

    const startIndex = index - props.currentStreak + 1;

    if (startIndex < 0 || startIndex >= props.days.length) {
        return null;
    }

    return props.days[startIndex].date;
});

const longestStreakRange = computed<{ start: string; end: string } | null>(
    () => {
        if (props.longestStreak <= 0 || props.days.length === 0) {
            return null;
        }

        let runStart = 0;
        let runLength = 0;
        let bestStart = 0;
        let bestEnd = 0;
        let bestLength = 0;

        props.days.forEach((day, index) => {
            if (day.seconds > 0) {
                if (runLength === 0) {
                    runStart = index;
                }

                runLength += 1;

                if (runLength > bestLength) {
                    bestLength = runLength;
                    bestStart = runStart;
                    bestEnd = index;
                }
            } else {
                runLength = 0;
            }
        });

        if (bestLength === 0) {
            return null;
        }

        return {
            start: props.days[bestStart].date,
            end: props.days[bestEnd].date,
        };
    },
);

function cellTitle(cell: Cell): string {
    if (!cell) {
        return '';
    }

    return `${formatDate(cell.date)}・${formatDuration(cell.seconds)}`;
}

const scrollContainer = ref<HTMLDivElement | null>(null);

function scrollToLatest(): void {
    const el = scrollContainer.value;

    if (!el) {
        return;
    }

    el.scrollLeft = el.scrollWidth;
}

onMounted(() => {
    void nextTick(scrollToLatest);
});

watch(
    () => props.days,
    () => {
        void nextTick(scrollToLatest);
    },
);
</script>

<template>
    <div class="space-y-4">
        <div class="space-y-2">
            <div class="flex flex-wrap gap-2">
                <div
                    class="flex min-w-[9rem] flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg border border-theme-200 bg-theme-50 p-3 dark:border-zinc-700 dark:bg-zinc-800"
                >
                    <p
                        class="shrink-0 text-xs leading-tight text-theme-700 dark:text-zinc-400"
                    >
                        目前<br />連續
                    </p>
                    <div class="ml-auto text-right">
                        <p
                            class="text-xl font-semibold text-theme-900 dark:text-zinc-100"
                        >
                            {{ currentStreak }}
                            <small
                                class="text-xs text-theme-700 dark:text-zinc-400"
                                >天</small
                            >
                        </p>
                        <p
                            class="min-h-[2lh] text-xs whitespace-nowrap text-theme-700 dark:text-zinc-400"
                        >
                            {{
                                currentStreakStartDate
                                    ? `${formatDateSlash(currentStreakStartDate)} ~`
                                    : '—'
                            }}
                        </p>
                    </div>
                </div>
                <div
                    class="flex min-w-[9rem] flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg border border-theme-200 bg-theme-50 p-3 dark:border-zinc-700 dark:bg-zinc-800"
                >
                    <p
                        class="shrink-0 text-xs leading-tight text-theme-700 dark:text-zinc-400"
                    >
                        最長<br />連續
                    </p>
                    <div class="ml-auto text-right">
                        <p
                            class="text-xl font-semibold text-theme-900 dark:text-zinc-100"
                        >
                            {{ longestStreak }}
                            <small
                                class="text-xs text-theme-700 dark:text-zinc-400"
                                >天</small
                            >
                        </p>
                        <p
                            class="min-h-[2lh] text-xs whitespace-nowrap text-theme-700 dark:text-zinc-400"
                        >
                            <template v-if="longestStreakRange">
                                {{ formatDateSlash(longestStreakRange.start)
                                }}<br />
                                <template
                                    v-if="
                                        longestStreakRange.start !==
                                        longestStreakRange.end
                                    "
                                >
                                    ~
                                    {{
                                        formatDateSlash(longestStreakRange.end)
                                    }}
                                </template>
                            </template>
                            <template v-else>—</template>
                        </p>
                    </div>
                </div>
            </div>
            <div
                class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-theme-200 bg-theme-50 p-3 dark:border-zinc-700 dark:bg-zinc-800"
            >
                <p
                    class="text-xs leading-tight text-theme-700 dark:text-zinc-400"
                >
                    最長<br />單日學習時間
                </p>
                <div class="ml-auto text-right">
                    <p
                        class="text-xl font-semibold text-theme-900 dark:text-zinc-100"
                    >
                        {{
                            longestStudyDaySeconds > 0
                                ? formatDuration(longestStudyDaySeconds)
                                : '—'
                        }}
                    </p>
                    <p class="text-xs text-theme-700 dark:text-zinc-400">
                        {{
                            longestStudyDayDate
                                ? formatDateSlash(longestStudyDayDate)
                                : ''
                        }}
                    </p>
                </div>
            </div>
        </div>

        <div ref="scrollContainer" class="flex gap-2 overflow-x-auto pb-1">
            <div
                class="grid shrink-0 grid-rows-7 gap-1 pt-4 text-[10px] leading-3 text-theme-700 dark:text-zinc-400"
            >
                <span
                    v-for="(label, index) in WEEKDAY_LABELS"
                    :key="index"
                    class="flex h-3 w-3 items-center"
                >
                    {{ label }}
                </span>
            </div>

            <div
                class="grid auto-cols-max grid-flow-col grid-rows-[0.75rem_repeat(7,0.75rem)] gap-1"
            >
                <template v-for="(week, weekIndex) in weeks" :key="weekIndex">
                    <span
                        class="col-start-[var(--col)] row-start-1 text-[10px] leading-3 whitespace-nowrap text-theme-700 dark:text-zinc-400"
                        :style="{ '--col': weekIndex + 1 }"
                    >
                        {{ monthLabelFor(weekIndex) }}
                    </span>

                    <span
                        v-for="(cell, dayIndex) in week"
                        :key="dayIndex"
                        class="col-start-[var(--col)] size-3 rounded-sm"
                        :class="
                            cell
                                ? LEVEL_CLASSES[levelFor(cell.seconds)]
                                : 'bg-transparent'
                        "
                        :style="{
                            '--col': weekIndex + 1,
                            gridRowStart: dayIndex + 2,
                        }"
                        :title="cellTitle(cell)"
                    />
                </template>
            </div>

            <div
                class="grid shrink-0 grid-rows-7 gap-1 pt-4 text-[10px] leading-3 text-theme-700 dark:text-zinc-400"
            >
                <span
                    v-for="(label, index) in WEEKDAY_LABELS"
                    :key="index"
                    class="flex h-3 w-3 items-center"
                >
                    {{ label }}
                </span>
            </div>
        </div>
    </div>
</template>
