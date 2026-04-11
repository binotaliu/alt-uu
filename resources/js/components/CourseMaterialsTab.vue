<script setup lang="ts">
import MaterialDirectory from '@/components/MaterialDirectory.vue';
import type { CourseLearningTimeItem } from '@/types';

defineProps<{
    cid: string;
    learningTimeItems: CourseLearningTimeItem[];
    isLoading: boolean;
    error?: string | null;
}>();
</script>

<template>
    <div
        v-if="isLoading"
        class="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-warm-200 bg-white/85 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/85"
    >
        <div
            v-for="(pct, i) in [72, 58, 81, 64, 76]"
            :key="i"
            class="flex items-center justify-between gap-3 border-b border-warm-100 px-4 py-3.5 last:border-0 dark:border-zinc-800"
        >
            <div
                class="h-4 animate-pulse rounded bg-warm-200 dark:bg-zinc-700"
                :style="{ width: `${pct}%` }"
            />
            <div
                class="h-6 w-20 shrink-0 animate-pulse rounded-full bg-warm-200 dark:bg-zinc-700"
            />
        </div>
    </div>

    <div
        v-else-if="error"
        class="rounded-xl border border-dashed border-rose-300 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300"
    >
        {{ error || '載入學習時間失敗' }}
    </div>

    <div
        v-else
        class="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-warm-200 bg-white/85 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/85"
    >
        <MaterialDirectory
            node-select-mode="link"
            :selected-cid="cid"
            :learning-time-items="learningTimeItems"
            :is-loading="isLoading"
            @large-directory="$emit('large-directory', $event)"
        />
    </div>
</template>
