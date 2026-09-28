<script setup lang="ts">
import { computed, ref } from 'vue';
import ErrorRetry from '@/components/ErrorRetry.vue';
import type { ApiError } from '@/lib/apiError';
import {
    isNativeAttachmentBridgeAvailable,
    openAttachmentInBrowser,
    openLocalAttachmentWithNativeBridge,
    queueAttachmentDownloadTask,
    waitForAttachmentDownloadCompletion,
} from '@/lib/nativeAttachment';
import type { CourseHomeworkItem, SchoolPortalHomeworkNotice } from '@/types';
import homeworkPortalCss from '../../css/attachment-browser/homework.css?raw';

const props = defineProps<{
    cid: string;
    items: CourseHomeworkItem[];
    schoolPortalNotices: SchoolPortalHomeworkNotice[];
    isLoading: boolean;
    error?: string | null;
    errorDetail?: ApiError | null;
}>();
const emit = defineEmits<{
    (e: 'opened-in-app-browser'): void;
    (e: 'retry'): void;
}>();

const hasAnyItems = computed(
    () => props.items.length > 0 || props.schoolPortalNotices.length > 0,
);

const openingIndex = ref<number | null>(null);

async function openHomework(index: number, url: string): Promise<void> {
    openingIndex.value = index;
    emit('opened-in-app-browser');

    try {
        await openAttachmentInBrowser(url, { css: homeworkPortalCss });
    } finally {
        openingIndex.value = null;
    }
}

const downloadingIndex = ref<number | null>(null);
const downloadErrors = ref<Record<number, string | null>>({});

function extractDownloadFilename(url: string): string | null {
    try {
        const filename = new URL(url).searchParams.get('filename');

        return filename ? `${filename}.pdf` : null;
    } catch {
        return null;
    }
}

function openDownloadFallback(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
}

async function downloadSchoolPortalAttachment(
    index: number,
    url: string,
): Promise<void> {
    if (downloadingIndex.value !== null) {
        return;
    }

    downloadingIndex.value = index;
    downloadErrors.value[index] = null;

    try {
        if (!isNativeAttachmentBridgeAvailable()) {
            openDownloadFallback(url);

            return;
        }

        const queuedTask = await queueAttachmentDownloadTask({
            cid: props.cid,
            sourceUrl: url,
            filename: extractDownloadFilename(url),
            source: 'school_portal',
        });

        const completedTask = await waitForAttachmentDownloadCompletion(
            queuedTask.taskId,
        );

        if (
            completedTask.status === 'completed' &&
            completedTask.localFilePath
        ) {
            const opened = await openLocalAttachmentWithNativeBridge(
                completedTask.localFilePath,
                completedTask.mimeType,
            );

            if (!opened) {
                openDownloadFallback(url);
            }

            return;
        }

        if (completedTask.status === 'failed') {
            downloadErrors.value[index] =
                completedTask.errorMessage ?? '下載失敗，請稍後再試。';
        }
    } catch (error) {
        downloadErrors.value[index] =
            error instanceof Error ? error.message : '下載失敗，請稍後再試。';
    } finally {
        downloadingIndex.value = null;
    }
}
</script>

<template>
    <div
        v-if="isLoading"
        class="mx-auto max-w-4xl rounded-2xl border border-theme-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5 dark:border-zinc-700 dark:bg-zinc-900/90"
    >
        <div v-for="row in 4" :key="row" class="mb-3 last:mb-0">
            <div
                class="h-5 w-3/5 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
            />
            <div
                class="mt-2 h-4 w-2/5 animate-pulse rounded bg-theme-100 dark:bg-zinc-800"
            />
        </div>
    </div>

    <ErrorRetry
        v-else-if="error"
        :message="error || '載入作業失敗'"
        :retrying="isLoading"
        :detail="errorDetail"
        @retry="emit('retry')"
    />

    <div
        v-else-if="!hasAnyItems"
        class="rounded-xl border border-dashed border-theme-300 bg-theme-50 p-4 text-sm text-theme-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
    >
        目前沒有可顯示的作業。
    </div>

    <div v-else class="mx-auto max-w-4xl space-y-6">
        <section v-if="schoolPortalNotices.length > 0" class="space-y-3">
            <h3 class="text-sm font-semibold text-theme-700 dark:text-zinc-300">
                教務系統作業附件
            </h3>

            <article
                v-for="(notice, sectionIndex) in schoolPortalNotices"
                :key="`school-portal-${notice.title}-${sectionIndex}`"
                class="rounded-2xl border border-theme-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90"
            >
                <h4
                    class="text-base font-semibold text-theme-900 dark:text-zinc-100"
                >
                    {{ notice.title }}
                </h4>

                <p
                    v-if="notice.dueDate"
                    class="mt-1 text-sm text-theme-700 dark:text-zinc-300"
                >
                    {{ notice.dueDate }}
                </p>

                <p
                    v-if="notice.submissionMethod"
                    class="mt-1 text-xs text-theme-700 dark:text-zinc-400"
                >
                    繳交方式：{{ notice.submissionMethod }}
                </p>

                <p
                    v-if="downloadErrors[sectionIndex]"
                    class="mt-1 text-xs text-rose-600 dark:text-rose-400"
                >
                    {{ downloadErrors[sectionIndex] }}
                </p>

                <div class="mt-3">
                    <button
                        type="button"
                        class="rounded-lg bg-theme-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-theme-700 disabled:cursor-not-allowed disabled:bg-theme-400 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400"
                        :disabled="
                            !notice.downloadUrl ||
                            downloadingIndex === sectionIndex
                        "
                        @click="
                            notice.downloadUrl &&
                            downloadSchoolPortalAttachment(
                                sectionIndex,
                                notice.downloadUrl,
                            )
                        "
                    >
                        {{
                            downloadingIndex === sectionIndex
                                ? '下載中...'
                                : '下載附件'
                        }}
                    </button>
                </div>
            </article>
        </section>

        <section v-if="items.length > 0" class="space-y-3">
            <h3
                v-if="schoolPortalNotices.length > 0"
                class="text-sm font-semibold text-theme-700 dark:text-zinc-300"
            >
                數位學習平台作業
            </h3>

            <article
                v-for="(item, index) in items"
                :key="`${item.type}-${item.title}-${index}`"
                class="rounded-2xl border border-theme-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90"
            >
                <div class="flex items-center gap-2">
                    <h4
                        class="text-base font-semibold text-theme-900 dark:text-zinc-100"
                    >
                        {{ item.title }}
                    </h4>
                    <span
                        v-if="item.percent"
                        class="rounded-full bg-theme-100 px-2 py-0.5 text-xs text-theme-800 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                        {{ item.percent }}
                    </span>
                </div>

                <p
                    v-if="item.status"
                    class="mt-1 text-sm text-theme-700 dark:text-zinc-300"
                >
                    {{ item.status }}
                </p>

                <p
                    v-if="item.window"
                    class="mt-1 text-xs text-theme-700 dark:text-zinc-400"
                >
                    {{ item.window }}
                </p>

                <div class="mt-3 flex flex-wrap gap-2">
                    <button
                        type="button"
                        class="rounded-lg bg-theme-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-theme-700 disabled:cursor-not-allowed disabled:bg-theme-400 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400"
                        :disabled="!item.actionUrl || openingIndex === index"
                        @click="
                            item.actionUrl &&
                            openHomework(index, item.actionUrl)
                        "
                    >
                        {{ openingIndex === index ? '開啟中...' : '進行作業' }}
                    </button>

                    <button
                        type="button"
                        class="rounded-lg border border-theme-300 px-3 py-1.5 text-sm font-medium text-theme-700 transition hover:bg-theme-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        :disabled="!item.resultUrl || openingIndex === index"
                        @click="
                            item.resultUrl &&
                            openHomework(index, item.resultUrl)
                        "
                    >
                        檢視結果
                    </button>
                </div>
            </article>
        </section>
    </div>
</template>
