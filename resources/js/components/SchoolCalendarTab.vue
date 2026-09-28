<script setup lang="ts">
import { computed } from 'vue';
import ErrorRetry from '@/components/ErrorRetry.vue';
import type { ApiError } from '@/lib/apiError';
import type { NouToolsSchoolCalendarEvent } from '@/types';

type EventStatus = 'upcoming' | 'ongoing' | 'ended';

type EventPresentation = NouToolsSchoolCalendarEvent & {
    status: EventStatus;
    daysUntil: number;
    rangeLabel: string;
};

const props = defineProps<{
    schoolCalendar: NouToolsSchoolCalendarEvent[];
    isLoading: boolean;
    error: string | null;
    errorDetail?: ApiError | null;
}>();

const emit = defineEmits<{
    retry: [];
}>();

function dayStart(dateText: string): Date {
    return new Date(`${dateText}T00:00:00+08:00`);
}

function formatMonthDay(dateText: string): string {
    const parsed = dayStart(dateText);

    if (Number.isNaN(parsed.getTime())) {
        return dateText;
    }

    return parsed.toLocaleDateString('zh-TW', {
        month: 'numeric',
        day: 'numeric',
    });
}

function formatWeekday(dateText: string): string {
    const parsed = dayStart(dateText);

    if (Number.isNaN(parsed.getTime())) {
        return '';
    }

    return parsed.toLocaleDateString('zh-TW', { weekday: 'short' });
}

function formatDateWithWeekday(dateText: string): string {
    const weekday = formatWeekday(dateText);

    return weekday
        ? `${formatMonthDay(dateText)} (${weekday})`
        : formatMonthDay(dateText);
}

function formatRangeLabel(startDate: string, endDate: string): string {
    if (startDate === endDate) {
        return formatDateWithWeekday(startDate);
    }

    return `${formatDateWithWeekday(startDate)} - ${formatDateWithWeekday(endDate)}`;
}

function formatMonthLabel(dateText: string): string {
    const parsed = dayStart(dateText);

    if (Number.isNaN(parsed.getTime())) {
        return dateText;
    }

    return parsed.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
    });
}

function formatMonthKey(dateText: string): string {
    const parsed = dayStart(dateText);

    if (Number.isNaN(parsed.getTime())) {
        return dateText;
    }

    return `${parsed.getFullYear()}-${`${parsed.getMonth() + 1}`.padStart(2, '0')}`;
}

type MonthBlock = {
    monthLabel: string;
    monthKey: string;
    events: EventPresentation[];
};

function groupByMonth(events: EventPresentation[]): MonthBlock[] {
    const monthGroups = new Map<string, MonthBlock>();

    for (const event of events) {
        const monthKey = formatMonthKey(event.startDate);
        const monthLabel = formatMonthLabel(event.startDate);

        if (!monthGroups.has(monthKey)) {
            monthGroups.set(monthKey, {
                monthLabel,
                monthKey,
                events: [],
            });
        }

        monthGroups.get(monthKey)!.events.push(event);
    }

    return Array.from(monthGroups.values());
}

const normalizedSchoolCalendar = computed<EventPresentation[]>(() => {
    const now = new Date();
    const today = new Date(
        `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}T00:00:00+08:00`,
    );

    return [...props.schoolCalendar]
        .sort((left, right) => left.startDate.localeCompare(right.startDate))
        .map((event) => {
            const start = dayStart(event.startDate);
            const end = dayStart(event.endDate);
            const diffMs = start.getTime() - today.getTime();
            const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

            let status: EventStatus = 'upcoming';

            if (today > end) {
                status = 'ended';
            } else if (today >= start && today <= end) {
                status = 'ongoing';
            }

            return {
                ...event,
                status,
                daysUntil,
                rangeLabel: formatRangeLabel(event.startDate, event.endDate),
            };
        });
});

const countdownEvent = computed<EventPresentation | null>(() => {
    const countdownEvents = normalizedSchoolCalendar.value.filter(
        (event) => event.isCountdown,
    );

    // 優先顯示第一個尚未結束的 countdown（即 upcoming，其次 ongoing）
    const upcomingCountdown = countdownEvents.find(
        (event) => event.status === 'upcoming',
    );

    if (upcomingCountdown) {
        return upcomingCountdown;
    }

    return countdownEvents.find((event) => event.status === 'ongoing') ?? null;
});

function isCountdownEvent(event: EventPresentation): boolean {
    return (
        event.name === countdownEvent.value?.name &&
        event.startDate === countdownEvent.value?.startDate &&
        event.endDate === countdownEvent.value?.endDate
    );
}

const timelineEvents = computed<EventPresentation[]>(() => {
    return normalizedSchoolCalendar.value.filter(
        (event) => !isCountdownEvent(event),
    );
});

const upcomingEvents = computed<EventPresentation[]>(() => {
    return timelineEvents.value.filter((event) => event.status !== 'ended');
});

const endedEvents = computed<EventPresentation[]>(() => {
    return timelineEvents.value.filter((event) => event.status === 'ended');
});

const groups = computed(() => [
    {
        label: '即將開始 / 進行中',
        emptyStateMessage: '目前沒有即將開始或進行中的活動。',
        events: upcomingEvents.value,
        monthGroups: groupByMonth(upcomingEvents.value),
    },
    {
        label: '已結束',
        emptyStateMessage: '目前沒有已結束的活動。',
        events: endedEvents.value,
        monthGroups: groupByMonth(endedEvents.value),
    },
]);
</script>

<template>
    <div class="space-y-4">
        <div v-if="props.isLoading" class="space-y-4">
            <div
                class="rounded-2xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <div
                    class="h-4 w-48 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
                />
                <div
                    class="mt-3 h-3 w-36 animate-pulse rounded bg-theme-100 dark:bg-zinc-800"
                />
            </div>

            <div class="space-y-3">
                <div
                    v-for="item in 8"
                    :key="item"
                    class="rounded-2xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                    <div class="flex items-center justify-between gap-2">
                        <div
                            class="h-4 w-2/3 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
                        />
                        <div
                            class="h-3 w-24 animate-pulse rounded bg-theme-100 dark:bg-zinc-800"
                        />
                    </div>
                    <div
                        class="mt-2 h-3 w-1/2 animate-pulse rounded bg-theme-100 dark:bg-zinc-800"
                    />
                </div>
            </div>
        </div>

        <ErrorRetry
            v-else-if="props.error"
            :message="props.error"
            :retrying="props.isLoading"
            :detail="props.errorDetail"
            @retry="emit('retry')"
        />

        <div
            v-else-if="normalizedSchoolCalendar.length === 0"
            class="rounded-2xl border border-dashed border-theme-300 bg-theme-50 p-4 text-sm text-theme-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
        >
            目前沒有可顯示的學校行事曆。
        </div>

        <template v-else>
            <section
                v-if="countdownEvent"
                class="sticky top-[calc(var(--inset-top,0px)+0.5rem)] z-10 flex items-center justify-between rounded-2xl border border-theme-200 bg-linear-to-br from-theme-50 to-white p-4 shadow-sm dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-900"
            >
                <div class="flex flex-col gap-1">
                    <h3
                        class="text-base font-semibold text-theme-900 dark:text-zinc-100"
                    >
                        {{ countdownEvent.name }}
                    </h3>
                    <p class="text-sm text-theme-700 dark:text-zinc-300">
                        {{ countdownEvent.rangeLabel }}
                    </p>
                </div>

                <div class="flex items-center justify-between gap-2">
                    <p
                        v-if="countdownEvent.status === 'ongoing'"
                        :class="[
                            'rounded-full px-2.5 py-1 text-xs font-semibold',
                            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
                        ]"
                    >
                        進行中
                    </p>

                    <div class="text-right" v-else>
                        <p
                            class="text-2xl font-bold text-theme-800 dark:text-zinc-100"
                        >
                            {{ Math.max(countdownEvent.daysUntil, 0) }}
                        </p>
                        <p class="text-xs text-theme-700 dark:text-zinc-400">
                            天後
                        </p>
                    </div>
                </div>
            </section>

            <section
                class="space-y-3"
                v-for="group in groups"
                :key="group.label"
            >
                <header
                    class="rounded-2xl border border-theme-200 bg-theme-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                    <h3
                        class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                    >
                        {{ group.label }}
                    </h3>
                </header>

                <div
                    v-if="group.events.length === 0"
                    class="rounded-2xl border border-dashed border-theme-300 bg-theme-50 p-4 text-sm text-theme-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                >
                    {{ group.emptyStateMessage }}
                </div>

                <template v-else>
                    <div
                        v-for="monthGroup in group.monthGroups"
                        :key="monthGroup.monthKey"
                        class="space-y-2"
                    >
                        <div
                            class="px-1 py-1 text-xs font-bold text-theme-700 dark:text-zinc-200"
                        >
                            {{ monthGroup.monthLabel }}
                        </div>

                        <article
                            v-for="event in monthGroup.events"
                            :key="`${event.name}-${event.startDate}-${event.endDate}`"
                            class="rounded-2xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0 flex-1">
                                    <h4
                                        class="line-clamp-2 text-sm font-semibold text-theme-900 dark:text-zinc-100"
                                    >
                                        {{ event.name }}
                                    </h4>
                                    <p
                                        class="mt-1 text-sm text-theme-700 dark:text-zinc-300"
                                    >
                                        {{ event.rangeLabel }}
                                    </p>
                                </div>

                                <div
                                    class="flex shrink-0 flex-col items-end gap-1"
                                >
                                    <span
                                        v-if="event.status !== 'upcoming'"
                                        :class="[
                                            'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                                            event.status === 'ongoing'
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                                                : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
                                        ]"
                                    >
                                        {{
                                            event.status === 'ongoing'
                                                ? '進行中'
                                                : '已結束'
                                        }}
                                    </span>
                                </div>
                            </div>
                        </article>
                    </div>
                </template>
            </section>
        </template>
    </div>
</template>
