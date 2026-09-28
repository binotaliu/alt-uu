<script setup lang="ts">
import ErrorRetry from '@/components/ErrorRetry.vue';
import MaterialDirectory from '@/components/MaterialDirectory.vue';
import type { ApiError } from '@/lib/apiError';
import type { CourseLearningTimeItem } from '@/types';

defineProps<{
    cid: string;
    learningTimeItems: CourseLearningTimeItem[];
    isLoading: boolean;
    error?: string | null;
    errorDetail?: ApiError | null;
    lastSeenIdentifier?: string | null;
    lastSeenPositionSeconds?: number | null;
    lastSeenDurationSeconds?: number | null;
}>();

const emit = defineEmits<{
    retry: [];
}>();
</script>

<template>
    <div
        v-if="isLoading"
        class="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-theme-200 bg-white/85 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/85"
    >
        <div
            v-for="(pct, i) in [72, 58, 81, 64, 76]"
            :key="i"
            class="flex items-center justify-between gap-3 border-b border-theme-100 px-4 py-3.5 last:border-0 dark:border-zinc-800"
        >
            <div
                class="h-4 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
                :style="{ width: `${pct}%` }"
            />
            <div
                class="h-6 w-20 shrink-0 animate-pulse rounded-full bg-theme-200 dark:bg-zinc-700"
            />
        </div>
    </div>

    <ErrorRetry
        v-else-if="error"
        :message="error || '載入學習時間失敗'"
        :retrying="isLoading"
        :detail="errorDetail"
        @retry="emit('retry')"
    />

    <div
        v-else
        class="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-theme-200 bg-white/85 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/85"
    >
        <MaterialDirectory
            node-select-mode="link"
            :selected-cid="cid"
            :learning-time-items="learningTimeItems"
            :is-loading="isLoading"
            :last-seen-identifier="lastSeenIdentifier"
            :last-seen-position-seconds="lastSeenPositionSeconds"
            :last-seen-duration-seconds="lastSeenDurationSeconds"
        />
    </div>
</template>
