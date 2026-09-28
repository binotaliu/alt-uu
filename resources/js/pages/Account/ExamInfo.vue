<script setup lang="ts">
import { computed, onMounted } from 'vue';
import AppLayout from '@/components/AppLayout.vue';
import BackButton from '@/components/BackButton.vue';
import ErrorRetry from '@/components/ErrorRetry.vue';
import { useExamAgenda } from '@/composables/useCoursePath';
import { useTitle } from '@/composables/useTitle';
import { formatSchoolPortalTimeRange } from '@/lib/schoolPortalFormat';
import type { SchoolPortalExamAgendaItem } from '@/types';

useTitle('考試資訊');

const { items, isLoading, error, errorDetail, fetchAgenda } = useExamAgenda();

onMounted(() => {
    fetchAgenda();
});

interface ExamDateGroup {
    date: string;
    items: SchoolPortalExamAgendaItem[];
}

interface ExamGroup {
    label: string;
    dateGroups: ExamDateGroup[];
}

// A category reads e.g. "期中考(正考)" — everything already in this agenda is
// 正考, so the "(正考)" qualifier is redundant here; group by the "期中考"/
// "期末考" prefix instead of showing the raw category per item.
const GROUP_ORDER = ['期中考', '期末考'];
const NO_DATE = '';

function groupLabel(category: string): string {
    return category.replace(/[（(][^）)]*[）)]\s*$/, '').trim() || category;
}

const examGroups = computed<ExamGroup[]>(() => {
    const byLabel = new Map<string, SchoolPortalExamAgendaItem[]>();

    for (const item of items.value) {
        const label = groupLabel(item.category);
        const list = byLabel.get(label) ?? [];
        list.push(item);
        byLabel.set(label, list);
    }

    const labels = [
        ...GROUP_ORDER.filter((label) => byLabel.has(label)),
        ...[...byLabel.keys()].filter((label) => !GROUP_ORDER.includes(label)),
    ];

    return labels.map((label) => {
        const byDate = new Map<string, SchoolPortalExamAgendaItem[]>();

        for (const item of byLabel.get(label) ?? []) {
            const date = item.date ?? NO_DATE;
            const list = byDate.get(date) ?? [];
            list.push(item);
            byDate.set(date, list);
        }

        const dateGroups = [...byDate.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, items]) => ({ date, items }));

        return { label, dateGroups };
    });
});
</script>

<template>
    <AppLayout>
        <div
            class="sticky top-0 z-200 w-full bg-theme-100 py-1.5 pt-(--inset-top,4rem) pr-(--inset-right,0px) pl-[max(var(--inset-left,0px),var(--corner-inset-left,0px),1rem)] dark:bg-zinc-950"
        >
            <div
                class="flex items-center justify-between gap-2 pt-0.5 text-theme-900 dark:text-zinc-100"
            >
                <div class="flex items-center gap-2">
                    <BackButton href="/courses/account" />

                    <h2 class="text-lg font-semibold">考試資訊</h2>
                </div>
            </div>
        </div>

        <div
            class="mx-auto w-full max-w-2xl space-y-4 px-4 pb-[calc(var(--inset-bottom,0px)+2rem)]"
        >
            <div
                v-if="isLoading"
                class="rounded-xl border border-theme-200 bg-white p-4 text-center text-sm text-theme-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
            >
                載入考試資訊中…
            </div>

            <ErrorRetry
                v-else-if="error"
                :message="error"
                :detail="errorDetail"
                @retry="fetchAgenda"
            />

            <div
                v-else-if="examGroups.length === 0"
                class="rounded-xl border border-dashed border-theme-300 bg-theme-50 p-4 text-center text-sm text-theme-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
                查無考試資訊。
            </div>

            <div
                v-for="group in examGroups"
                :key="group.label"
                class="space-y-3"
            >
                <h3
                    class="px-1 text-sm font-semibold text-theme-700 dark:text-zinc-400"
                >
                    {{ group.label }}
                </h3>

                <div
                    v-for="dateGroup in group.dateGroups"
                    :key="`${group.label}-${dateGroup.date}`"
                    class="space-y-2"
                >
                    <h4
                        v-if="dateGroup.date"
                        class="px-1 text-xs font-medium text-theme-600 dark:text-zinc-500"
                    >
                        {{ dateGroup.date }}
                    </h4>

                    <div
                        v-for="(item, index) in dateGroup.items"
                        :key="`${group.label}-${dateGroup.date}-${item.courseName}-${index}`"
                        class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                    >
                        <p
                            class="truncate font-medium text-theme-900 dark:text-zinc-100"
                        >
                            {{ item.courseName }}
                        </p>

                        <dl
                            class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-theme-700 dark:text-zinc-400"
                        >
                            <div class="flex items-center gap-1">
                                <dt>時間</dt>
                                <dd
                                    class="font-medium text-theme-900 dark:text-zinc-200"
                                >
                                    {{ formatSchoolPortalTimeRange(item.time) }}
                                </dd>
                            </div>
                            <div
                                v-if="item.room"
                                class="flex items-center gap-1"
                            >
                                <dt>教室</dt>
                                <dd
                                    class="font-medium text-theme-900 dark:text-zinc-200"
                                >
                                    {{ item.room }}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
