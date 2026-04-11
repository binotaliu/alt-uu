<script setup lang="ts">
import { computed } from 'vue';
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

function formatRangeLabel(startDate: string, endDate: string): string {
    if (startDate === endDate) {
        return formatMonthDay(startDate);
    }

    return `${formatMonthDay(startDate)} - ${formatMonthDay(endDate)}`;
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

    // 1. 優先顯示第一個尚未結束的 countdown（即 ongoing 或 upcoming），但先找 upcoming
    const upcomingCountdown = countdownEvents.find(
        (event) => event.status === 'upcoming',
    );

    if (upcomingCountdown) {
        return upcomingCountdown;
    }

    const ongoingCountdown = countdownEvents.find(
        (event) => event.status === 'ongoing',
    );

    if (ongoingCountdown) {
        return ongoingCountdown;
    }

    // 2. 找下一個非已結束事件（不管是否 countdown）
    const activeOrUpcoming = normalizedSchoolCalendar.value.find(
        (event) => event.status !== 'ended',
    );

    if (activeOrUpcoming) {
        return activeOrUpcoming;
    }

    // 3. 最後 fallback 全部列表第一筆
    return normalizedSchoolCalendar.value[0] ?? null;
});

const timelineEvents = computed<EventPresentation[]>(() => {
    if (!countdownEvent.value) {
        return normalizedSchoolCalendar.value;
    }

    return normalizedSchoolCalendar.value.filter(
        (event) =>
            !(
                event.name === countdownEvent.value?.name &&
                event.startDate === countdownEvent.value?.startDate &&
                event.endDate === countdownEvent.value?.endDate
            ),
    );
});
</script>

<template>
    <div class="space-y-4">
        <div v-if="props.isLoading" class="space-y-4">
            <div
                class="rounded-2xl border border-warm-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <div
                    class="h-4 w-48 animate-pulse rounded bg-warm-200 dark:bg-zinc-700"
                />
                <div
                    class="mt-3 h-3 w-36 animate-pulse rounded bg-warm-100 dark:bg-zinc-800"
                />
            </div>

            <div class="space-y-3">
                <div
                    v-for="item in 8"
                    :key="item"
                    class="rounded-2xl border border-warm-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                    <div class="flex items-center justify-between gap-2">
                        <div
                            class="h-4 w-2/3 animate-pulse rounded bg-warm-200 dark:bg-zinc-700"
                        />
                        <div
                            class="h-3 w-24 animate-pulse rounded bg-warm-100 dark:bg-zinc-800"
                        />
                    </div>
                    <div
                        class="mt-2 h-3 w-1/2 animate-pulse rounded bg-warm-100 dark:bg-zinc-800"
                    />
                </div>
            </div>
        </div>

        <div
            v-else-if="props.error"
            class="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700"
        >
            {{ props.error }}
        </div>

        <div
            v-else-if="normalizedSchoolCalendar.length === 0"
            class="rounded-2xl border border-dashed border-warm-300 bg-warm-50 p-4 text-sm text-warm-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
        >
            目前沒有可顯示的學校行事曆。
        </div>

        <template v-else>
            <section
                v-if="countdownEvent"
                class="flex items-center justify-between rounded-2xl border border-warm-200 bg-linear-to-br from-warm-50 to-white p-4 shadow-sm dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-900"
            >
                <div class="flex flex-col gap-1">
                    <h3
                        class="text-base font-semibold text-warm-900 dark:text-zinc-100"
                    >
                        {{ countdownEvent.name }}
                    </h3>
                    <p class="text-sm text-warm-700 dark:text-zinc-300">
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
                            class="text-2xl font-bold text-warm-800 dark:text-zinc-100"
                        >
                            {{ Math.max(countdownEvent.daysUntil, 0) }}
                        </p>
                        <p class="text-xs text-warm-600 dark:text-zinc-400">
                            天後
                        </p>
                    </div>
                </div>
            </section>

            <section class="space-y-3">
                <article
                    v-for="event in timelineEvents"
                    :key="`${event.name}-${event.startDate}-${event.endDate}`"
                    class="rounded-2xl border border-warm-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0 flex-1">
                            <h4
                                class="line-clamp-2 text-sm font-semibold text-warm-900 dark:text-zinc-100"
                            >
                                {{ event.name }}
                            </h4>
                            <p
                                class="mt-1 text-sm text-warm-700 dark:text-zinc-300"
                            >
                                {{ event.rangeLabel }}
                            </p>
                        </div>

                        <div class="flex shrink-0 flex-col items-end gap-1">
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
            </section>
        </template>
    </div>
</template>
