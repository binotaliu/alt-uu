<script setup lang="ts">
import ErrorRetry from '@/components/ErrorRetry.vue';
import type { ApiError } from '@/lib/apiError';
import type { DiscussBoardSection } from '@/types';

const props = defineProps<{
    courseId: string;
    boardSections: DiscussBoardSection[];
    boardLoadError?: string | null;
    boardLoadErrorDetail?: ApiError | null;
    isBoardsLoading: boolean;
}>();

const emit = defineEmits<{
    retry: [];
}>();

function boardLink(boardCid: string, bid: string): string {
    return `/courses/${encodeURIComponent(props.courseId)}/discuss/${encodeURIComponent(boardCid)}/${encodeURIComponent(bid)}`;
}
</script>

<template>
    <div
        class="mx-auto max-w-4xl rounded-2xl border border-theme-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5 dark:border-zinc-700 dark:bg-zinc-900/90"
    >
        <div
            class="mb-3 flex items-center gap-2 text-theme-900 dark:text-zinc-100"
        >
            <svg
                class="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path
                    d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                ></path>
            </svg>
            <h2 class="font-semibold">看板列表</h2>
        </div>

        <ErrorRetry
            v-if="boardLoadError"
            :message="boardLoadError || '載入討論板失敗'"
            :retrying="isBoardsLoading"
            :detail="boardLoadErrorDetail"
            @retry="emit('retry')"
        />

        <div
            v-else-if="
                isBoardsLoading &&
                boardSections.every((section) => section.boards.length === 0)
            "
            class="space-y-4"
        >
            <div v-for="section in 2" :key="section" class="space-y-2">
                <div
                    class="h-4 w-24 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
                />
                <div
                    v-for="row in 3"
                    :key="row"
                    class="h-14 animate-pulse rounded-xl bg-theme-100 dark:bg-zinc-800"
                />
            </div>
        </div>

        <div v-else class="space-y-5">
            <section
                v-for="section in boardSections"
                :key="section.courseId"
                class="space-y-2"
            >
                <header
                    class="border-b border-theme-200 pb-2 dark:border-zinc-700"
                >
                    <h3
                        class="text-sm font-semibold text-theme-900 md:text-base dark:text-zinc-100"
                    >
                        {{ section.title }}
                    </h3>
                </header>

                <div v-if="section.boards.length > 0" class="space-y-2">
                    <router-link
                        v-for="board in section.boards"
                        :key="`${section.courseId}-${board.boardId}`"
                        :to="boardLink(section.courseId, board.boardId)"
                        class="block w-full rounded-xl border border-theme-200 bg-white px-3 py-2 text-left text-base text-theme-700 transition hover:border-theme-400 md:text-lg dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-500"
                    >
                        <div class="flex items-center justify-between gap-2">
                            <p class="truncate font-medium">
                                {{ board.boardName || '未命名看板' }}
                            </p>
                            <span
                                v-if="board.hasNewPost"
                                class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-600/95 dark:text-amber-50"
                            >
                                新文章
                            </span>
                        </div>
                        <p
                            class="text-sm text-theme-700 md:text-base dark:text-zinc-300"
                        >
                            主題數：{{ board.subjectCount ?? 0 }}
                        </p>
                    </router-link>
                </div>

                <p
                    v-else
                    class="rounded-xl border border-dashed border-theme-300 bg-theme-50 p-4 text-sm text-theme-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                    目前沒有可顯示的討論板。
                </p>
            </section>
        </div>
    </div>
</template>
