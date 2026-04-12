<script setup lang="ts">
import {
    ChatBubbleLeftRightIcon,
    PlusIcon,
    HandThumbUpIcon,
} from '@heroicons/vue/24/outline';
import { onMounted, computed, ref } from 'vue';
import AndroidBottomControlBackground from '@/components/AndroidBottomControlBackground.vue';
import AppLayout from '@/components/AppLayout.vue';
import BackButton from '@/components/BackButton.vue';
import DiscussComposeModal from '@/components/DiscussComposeModal.vue';
import PageHeader from '@/components/PageHeader.vue';
import { useCourses } from '@/composables/useCourses';
import { useDiscuss } from '@/composables/useDiscuss';
import { useModeration } from '@/composables/useModeration';
import { useTitle } from '@/composables/useTitle';
import type { CourseItem } from '@/types';

useTitle('文章列表');

const props = defineProps<{
    cid: string;
    boardCid: string;
    bid: string;
}>();

const { courses, fetchCourses } = useCourses();
const { data, isLoading, error, fetchDiscuss, createPost } = useDiscuss();
const { loadBlockedUsers, getReasonLabel } = useModeration();

const revealedNodes = ref<Set<string>>(new Set());

const newPostSubject = ref('');
const newPostContent = ref('');
const isComposeModalOpen = ref(false);
const isSubmittingPost = ref(false);
const selectedCourse = computed<CourseItem | null>(
    () => courses.value.find((c) => c.courseId === props.cid) ?? null,
);

const courseTitle = computed(
    () => selectedCourse.value?.name || `課程 ${props.cid}`,
);

const currentBoard = computed(() =>
    data.value?.boards.find((item) => item.boardId === props.bid),
);

const canCreatePost = computed(() => currentBoard.value?.allowPost ?? false);

const boardTitle = computed(() => {
    const board = currentBoard.value;

    return board?.boardName || '討論板';
});

const courseShowUrl = computed(() => {
    const base = `/courses/${encodeURIComponent(props.cid)}`;

    // 在從討論板返回時，指定 discuss tab
    return `${base}?tab=discuss#discuss`;
});

function nodeLink(nid: string): string {
    return `/courses/${encodeURIComponent(props.cid)}/discuss/${encodeURIComponent(props.boardCid)}/${encodeURIComponent(props.bid)}/${encodeURIComponent(nid)}`;
}

const submitNewPost = async () => {
    if (!canCreatePost.value) {
        error.value = '本討論板禁止發文。';

        return;
    }

    if (!newPostContent.value.trim()) {
        return;
    }

    try {
        isSubmittingPost.value = true;
        await createPost(
            props.bid,
            newPostSubject.value || '新文章',
            newPostContent.value,
        );
        newPostSubject.value = '';
        newPostContent.value = '';
        isComposeModalOpen.value = false;
        await fetchDiscuss(props.boardCid, props.bid, undefined, {
            includeCourses: false,
        });
    } catch (createError) {
        console.error('createPost failed', createError);
        error.value =
            createError instanceof Error ? createError.message : '送出文章失敗';
    } finally {
        isSubmittingPost.value = false;
    }
};

onMounted(async () => {
    await Promise.all([
        fetchCourses(),
        fetchDiscuss(props.boardCid, props.bid, undefined, {
            includeCourses: false,
            force: true,
        }),
        loadBlockedUsers(),
    ]);
});
</script>

<template>
    <AppLayout>
        <PageHeader
            :title="courseTitle"
            :subtitle="boardTitle"
            :isLoading="isLoading || !selectedCourse"
        >
            <template #left>
                <BackButton :href="courseShowUrl" />
            </template>

            <template #right>
                <div
                    v-if="!isLoading && canCreatePost"
                    class="flex items-center gap-3"
                >
                    <button
                        type="button"
                        class="inline-flex items-center gap-1 rounded-xl bg-warm-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-warm-800 dark:bg-warm-800 dark:hover:bg-warm-700"
                        @click="isComposeModalOpen = true"
                    >
                        <PlusIcon class="size-4 md:size-5" />
                        <span class="sr-only md:not-sr-only"> 新增文章 </span>
                    </button>
                </div>
            </template>
        </PageHeader>

        <section class="px-3 py-4 pb-24 sm:px-4">
            <div
                class="mx-auto max-w-4xl rounded-2xl border border-warm-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5 dark:border-zinc-700 dark:bg-zinc-900/90"
            >
                <div
                    class="mb-3 flex items-center gap-2 text-warm-900 dark:text-zinc-100"
                >
                    <ChatBubbleLeftRightIcon class="h-5 w-5" />
                    <h2 class="font-semibold">文章列表</h2>
                </div>

                <div
                    v-if="error"
                    class="rounded-xl border border-dashed border-rose-300 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300"
                >
                    {{ error }}
                </div>

                <div
                    v-else-if="isLoading && (!data || data.nodes.length === 0)"
                    class="space-y-2"
                >
                    <div
                        v-for="row in 5"
                        :key="row"
                        class="h-14 animate-pulse rounded-xl bg-warm-100 dark:bg-zinc-700"
                    />
                </div>

                <div
                    v-else-if="data && data.nodes.length > 0"
                    class="space-y-2"
                >
                    <template v-for="node in data.nodes" :key="node.node">
                        <div
                            v-if="
                                node.isBlocked && !revealedNodes.has(node.node)
                            "
                            class="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
                        >
                            <p>
                                本內容經檢舉已在 Alt UU
                                中隱藏，若有需要請前往其他平台檢視。原因：{{
                                    getReasonLabel(node.blockedReason ?? '')
                                }}。
                            </p>
                            <button
                                type="button"
                                class="mt-1 text-xs font-medium text-amber-600 underline hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
                                @click="revealedNodes.add(node.node)"
                            >
                                仍要檢視
                            </button>
                        </div>

                        <router-link
                            v-else
                            :to="nodeLink(node.node)"
                            class="block w-full rounded-xl border border-warm-200 bg-white px-3 py-2 text-left text-sm text-warm-700 transition hover:border-warm-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <p class="truncate font-medium md:text-lg">
                                        {{ node.subject || '未命名主題' }}
                                        <span
                                            v-if="node.isRead === false"
                                            class="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-600/95 dark:text-amber-50"
                                        >
                                            未讀
                                        </span>
                                    </p>
                                    <p
                                        class="flex gap-1 text-sm text-warm-600 md:text-base dark:text-zinc-400"
                                    >
                                        <span>{{ node.poster ?? '匿名' }}</span>
                                        <span>·</span>
                                        <span
                                            >{{
                                                node.repliesCount ?? ''
                                            }}
                                            則回覆</span
                                        >
                                    </p>
                                </div>

                                <span
                                    v-if="
                                        node.likesCount && node.likesCount > 0
                                    "
                                    class="ml-2 inline-flex items-center gap-1 text-warm-500 md:gap-2 dark:text-zinc-500"
                                >
                                    <HandThumbUpIcon class="size-4 md:size-5" />
                                    <span class="md:text-xl">{{
                                        node.likesCount
                                    }}</span>
                                </span>
                            </div>
                        </router-link>
                    </template>
                </div>

                <div
                    v-else
                    class="rounded-xl border border-dashed border-warm-300 bg-warm-50 p-4 text-sm text-warm-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                    目前沒有可顯示的文章主題。
                </div>
            </div>
        </section>

        <DiscussComposeModal
            v-model="isComposeModalOpen"
            title="新增文章"
            context-label="討論板"
            :context-value="boardTitle"
            submit-label="送出文章"
            :is-submitting="isSubmittingPost"
            @submit="submitNewPost"
        >
            <input
                v-model="newPostSubject"
                class="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-warm-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                placeholder="主題（選填）"
            />
            <textarea
                v-model="newPostContent"
                class="h-36 w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-warm-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                placeholder="內容"
            />
        </DiscussComposeModal>

        <AndroidBottomControlBackground />
    </AppLayout>
</template>
