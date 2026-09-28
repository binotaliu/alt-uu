<script setup lang="ts">
import { computed } from 'vue';
import ErrorRetry from '@/components/ErrorRetry.vue';
import type { ApiError } from '@/lib/apiError';
import type { SchoolPortalGrade } from '@/types';

const props = defineProps<{
    grade: SchoolPortalGrade | null;
    isLoading: boolean;
    error?: string | null;
    errorDetail?: ApiError | null;
}>();

const emit = defineEmits<{
    retry: [];
}>();

const isSummerSemester = computed(() =>
    props.grade ? props.grade.semesterLabel.includes('暑') : false,
);

const regularScoreItems = computed(() => {
    if (!props.grade) {
        return [];
    }

    return [
        { label: '第一次平時', value: props.grade.firstRegularScore },
        { label: '第二次平時', value: props.grade.secondRegularScore },
        { label: '學習參與', value: props.grade.participationScore },
    ];
});

const semesterScoreItems = computed(() => {
    if (!props.grade) {
        return [];
    }

    const items = [{ label: '平時成績', value: props.grade.regularAverage }];

    if (!isSummerSemester.value) {
        items.push({ label: '期中成績', value: props.grade.midtermScore });
    }

    items.push({ label: '期末成績', value: props.grade.finalScore });

    return items;
});
</script>

<template>
    <div
        v-if="isLoading"
        class="mx-auto max-w-4xl rounded-2xl border border-theme-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5 dark:border-zinc-700 dark:bg-zinc-900/90"
    >
        <div v-for="row in 5" :key="row" class="mb-3 last:mb-0">
            <div
                class="h-5 w-2/5 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
            />
        </div>
    </div>

    <ErrorRetry
        v-else-if="error"
        :message="error || '載入成績失敗'"
        :retrying="isLoading"
        :detail="errorDetail"
        @retry="emit('retry')"
    />

    <div
        v-else-if="!grade"
        class="rounded-xl border border-dashed border-theme-300 bg-theme-50 p-4 text-sm text-theme-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
    >
        本學期查無此課程的教務系統成績資料。
    </div>

    <div v-else class="mx-auto max-w-4xl space-y-4">
        <article
            class="flex items-center justify-between rounded-2xl border border-theme-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5 dark:border-zinc-700 dark:bg-zinc-900/90"
        >
            <h3 class="text-sm font-semibold text-theme-700 dark:text-zinc-300">
                {{ grade.semesterLabel }}
            </h3>
            <span
                v-if="grade.credits"
                class="rounded-full bg-theme-100 px-2.5 py-1 font-medium text-theme-800 dark:bg-zinc-800 dark:text-zinc-300"
            >
                {{ grade.credits }} 學分
            </span>
        </article>

        <article
            class="rounded-2xl border border-theme-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5 dark:border-zinc-700 dark:bg-zinc-900/90"
        >
            <h4
                class="text-xs font-semibold tracking-wide text-theme-700 dark:text-zinc-400"
            >
                平時成績
            </h4>

            <div class="mt-3 flex flex-wrap items-stretch justify-center gap-2">
                <template
                    v-for="(item, index) in regularScoreItems"
                    :key="item.label"
                >
                    <div
                        class="flex min-w-20 flex-col items-center justify-center rounded-xl border border-theme-200 px-3 py-2 dark:border-zinc-700"
                    >
                        <span
                            class="text-center text-xs text-theme-700 dark:text-zinc-400"
                        >
                            {{ item.label }}
                        </span>
                        <span
                            class="mt-1 text-sm font-semibold text-theme-900 dark:text-zinc-100"
                        >
                            {{ item.value ?? '無資料' }}
                        </span>
                    </div>
                    <span
                        v-if="index < regularScoreItems.length - 1"
                        class="flex items-center text-theme-700 dark:text-zinc-500"
                    >
                        +
                    </span>
                </template>
            </div>

            <div
                class="my-2 flex justify-center text-theme-700 dark:text-zinc-500"
            >
                ↓
            </div>

            <div
                class="flex flex-col items-center rounded-xl bg-theme-100 px-3 py-2 dark:bg-zinc-800"
            >
                <span class="text-xs text-theme-700 dark:text-zinc-400"
                    >平時成績</span
                >
                <span
                    class="mt-1 text-base font-semibold text-theme-900 dark:text-zinc-100"
                >
                    {{ grade.regularAverage ?? '無資料' }}
                </span>
            </div>
        </article>

        <article
            class="rounded-2xl border border-theme-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5 dark:border-zinc-700 dark:bg-zinc-900/90"
        >
            <h4
                class="text-xs font-semibold tracking-wide text-theme-700 dark:text-zinc-400"
            >
                學期成績
            </h4>

            <div class="mt-3 flex flex-wrap items-stretch justify-center gap-2">
                <template
                    v-for="(item, index) in semesterScoreItems"
                    :key="item.label"
                >
                    <div
                        class="flex min-w-20 flex-col items-center justify-center rounded-xl border border-theme-200 px-3 py-2 dark:border-zinc-700"
                    >
                        <span
                            class="text-center text-xs text-theme-700 dark:text-zinc-400"
                        >
                            {{ item.label }}
                        </span>
                        <span
                            class="mt-1 text-sm font-semibold text-theme-900 dark:text-zinc-100"
                        >
                            {{ item.value ?? '無資料' }}
                        </span>
                    </div>
                    <span
                        v-if="index < semesterScoreItems.length - 1"
                        class="flex items-center text-theme-700 dark:text-zinc-500"
                    >
                        +
                    </span>
                </template>
            </div>

            <div
                class="my-2 flex justify-center text-theme-700 dark:text-zinc-500"
            >
                ↓
            </div>

            <div
                class="flex flex-col items-center rounded-xl bg-emerald-100 px-3 py-2.5 dark:bg-emerald-900/50"
            >
                <span class="text-xs text-emerald-700 dark:text-emerald-300"
                    >學期成績</span
                >
                <span
                    class="mt-1 text-xl font-bold text-emerald-800 dark:text-emerald-200"
                >
                    {{ grade.semesterGrade ?? '無資料' }}
                </span>
            </div>
        </article>
    </div>
</template>
