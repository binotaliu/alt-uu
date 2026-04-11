<script setup lang="ts">
import { ref } from 'vue';
import { openAttachmentInBrowser } from '@/lib/nativeAttachment';
import type { CourseHomeworkItem } from '@/types';

defineProps<{
    items: CourseHomeworkItem[];
    isLoading: boolean;
    error?: string | null;
}>();
const emit = defineEmits<{
    (e: 'opened-in-app-browser'): void;
}>();

const openingIndex = ref<number | null>(null);

async function openHomework(index: number, url: string): Promise<void> {
    openingIndex.value = index;
    emit('opened-in-app-browser');

    try {
        await openAttachmentInBrowser(url);
    } finally {
        openingIndex.value = null;
    }
}
</script>

<template>
    <div
        v-if="isLoading"
        class="mx-auto max-w-4xl rounded-2xl border border-warm-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5 dark:border-zinc-700 dark:bg-zinc-900/90"
    >
        <div v-for="row in 4" :key="row" class="mb-3 last:mb-0">
            <div
                class="h-5 w-3/5 animate-pulse rounded bg-warm-200 dark:bg-zinc-700"
            />
            <div
                class="mt-2 h-4 w-2/5 animate-pulse rounded bg-warm-100 dark:bg-zinc-800"
            />
        </div>
    </div>

    <div
        v-else-if="error"
        class="rounded-xl border border-dashed border-rose-300 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300"
    >
        {{ error || '載入作業失敗' }}
    </div>

    <div
        v-else-if="items.length === 0"
        class="rounded-xl border border-dashed border-warm-300 bg-warm-50 p-4 text-sm text-warm-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
    >
        目前沒有可顯示的作業。
    </div>

    <div v-else class="mx-auto max-w-4xl space-y-3">
        <article
            v-for="(item, index) in items"
            :key="`${item.type}-${item.title}-${index}`"
            class="rounded-2xl border border-warm-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90"
        >
            <div class="flex items-center gap-2">
                <h3
                    class="text-base font-semibold text-warm-900 dark:text-zinc-100"
                >
                    {{ item.title }}
                </h3>
                <span
                    v-if="item.percent"
                    class="rounded-full bg-warm-100 px-2 py-0.5 text-xs text-warm-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                    {{ item.percent }}
                </span>
            </div>

            <p
                v-if="item.status"
                class="mt-1 text-sm text-warm-700 dark:text-zinc-300"
            >
                {{ item.status }}
            </p>

            <p
                v-if="item.window"
                class="mt-1 text-xs text-warm-600 dark:text-zinc-400"
            >
                {{ item.window }}
            </p>

            <div class="mt-3 flex flex-wrap gap-2">
                <button
                    type="button"
                    class="rounded-lg bg-warm-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-warm-700 disabled:cursor-not-allowed disabled:bg-warm-400 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400"
                    :disabled="!item.actionUrl || openingIndex === index"
                    @click="
                        item.actionUrl && openHomework(index, item.actionUrl)
                    "
                >
                    {{ openingIndex === index ? '開啟中...' : '進行作業' }}
                </button>

                <button
                    type="button"
                    class="rounded-lg border border-warm-300 px-3 py-1.5 text-sm font-medium text-warm-700 transition hover:bg-warm-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    :disabled="!item.resultUrl || openingIndex === index"
                    @click="
                        item.resultUrl && openHomework(index, item.resultUrl)
                    "
                >
                    查看結果
                </button>
            </div>
        </article>
    </div>
</template>
