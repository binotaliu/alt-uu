<script setup lang="ts">
import {
    ChatBubbleLeftRightIcon,
    ExclamationTriangleIcon,
    FlagIcon,
    NoSymbolIcon,
    PaperClipIcon,
    PlusIcon,
} from '@heroicons/vue/24/outline';
import { HandThumbUpIcon as HandThumbUpIconOutline } from '@heroicons/vue/24/outline';
import { HandThumbUpIcon as HandThumbUpIconSolid } from '@heroicons/vue/24/solid';
import { onMounted, computed, ref } from 'vue';
import { Browser } from '#nativephp';
import AndroidBottomControlBackground from '@/components/AndroidBottomControlBackground.vue';
import AppLayout from '@/components/AppLayout.vue';
import BackButton from '@/components/BackButton.vue';
import DiscussComposeModal from '@/components/DiscussComposeModal.vue';
import PageHeader from '@/components/PageHeader.vue';
import ReportModal from '@/components/ReportModal.vue';
import { useCourses } from '@/composables/useCourses';
import { useDiscuss } from '@/composables/useDiscuss';
import { useIsDark } from '@/composables/useIsDark';
import { useModeration } from '@/composables/useModeration';
import { useTitle } from '@/composables/useTitle';
import { processHtmlForColorScheme } from '@/lib/htmlColorScheme';
import {
    isNativeAttachmentBridgeAvailable,
    openLocalAttachmentWithNativeBridge,
    queueAttachmentDownloadTask,
    waitForAttachmentDownloadCompletion,
} from '@/lib/nativeAttachment';
import type { CourseItem } from '@/types';

const props = defineProps<{
    cid: string;
    boardCid: string;
    bid: string;
    nid: string;
}>();

const { courses, fetchCourses } = useCourses();
const {
    data,
    isLoading,
    error,
    fetchDiscuss,
    setForumRead,
    createPost,
    updatePost,
    // deletePost,
    likePost,
    unlikePost,
    createWhisper,
    updateWhisper,
    // deleteWhisper,
} = useDiscuss();
const { isDark } = useIsDark();
const {
    loadBlockedUsers,
    isUserBlocked,
    getReasonLabel,
    reportContent,
    blockUser,
    unblockUser,
} = useModeration();

const revealedPosts = ref<Set<string>>(new Set());

function adjustedContent(html: string | null | undefined): string {
    return processHtmlForColorScheme(html ?? '', isDark.value);
}

useTitle('討論串');

const selectedCourse = computed<CourseItem | null>(
    () => courses.value.find((c) => c.courseId === props.cid) ?? null,
);

const courseTitle = computed(
    () => selectedCourse.value?.name || `課程 ${props.cid}`,
);

const boardTitle = computed(() => {
    const board = data.value?.boards.find((item) => item.boardId === props.bid);

    return board?.boardName || '討論板';
});

const threadTitle = computed(() => {
    const node = data.value?.nodes.find((item) => item.node === props.nid);

    if (node?.subject) {
        return node.subject;
    }

    const firstSubject = data.value?.posts.find(
        (post) => post.subject,
    )?.subject;

    return firstSubject || '文章內容';
});

const newPostSubject = ref('');
const newPostContent = ref('');
const isReplyModalOpen = ref(false);
const isSubmittingReply = ref(false);

const isWhisperModalOpen = ref(false);
const whisperModalNodeId = ref<string | null>(null);
const whisperModalFloor = ref<number | null>(null);
const whisperModalContent = ref('');
const isSubmittingWhisper = ref(false);

const editingPostId = ref<string | null>(null);
const editingPostContent = ref('');
const editingWhisperId = ref<string | null>(null);
const editingWhisperContent = ref('');

// Moderation state
const isReportModalOpen = ref(false);
const reportNodeId = ref<string | null>(null);
const reportContent_ = ref('');
const reportType = ref('');
const isSubmittingReport = ref(false);
const reportSuccess = ref<boolean | null>(null);

const isBlockConfirmOpen = ref(false);
const blockTargetPoster = ref('');
const blockTargetRealname = ref('');
const downloadingAttachmentKeys = ref<Set<string>>(new Set());
const pendingAttachmentDownload = ref<{
    url: string;
    filename: string | null;
} | null>(null);
const isAttachmentConfirmOpen = ref(false);
const isAttachmentDownloadInProgress = ref(false);
const attachmentDownloadStatus = ref('');
const attachmentDownloadError = ref<string | null>(null);

function buildProxyUrl(url: string): string {
    const proxyPath = `/material-proxy/${btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}?cid=${encodeURIComponent(props.cid)}`;

    return new URL(proxyPath, window.location.origin).toString();
}

const closeAttachmentConfirm = () => {
    attachmentDownloadError.value = null;

    if (isAttachmentDownloadInProgress.value) {
        return;
    }

    isAttachmentConfirmOpen.value = false;
    pendingAttachmentDownload.value = null;
};

const requestAttachmentDownload = (url: string, filename?: string | null) => {
    attachmentDownloadError.value = null;

    if (isAttachmentDownloadInProgress.value) {
        return;
    }

    pendingAttachmentDownload.value = {
        url,
        filename: filename ?? null,
    };
    isAttachmentConfirmOpen.value = true;
};

const performAttachmentDownload = async (
    url: string,
    filename?: string | null,
) => {
    const attachmentKey = `${url}::${filename ?? ''}`;

    if (downloadingAttachmentKeys.value.has(attachmentKey)) {
        return;
    }

    downloadingAttachmentKeys.value.add(attachmentKey);
    isAttachmentDownloadInProgress.value = true;

    try {
        if (!isNativeAttachmentBridgeAvailable()) {
            const proxyUrl = buildProxyUrl(url);
            window.open(proxyUrl, '_blank', 'noopener,noreferrer');

            return;
        }

        attachmentDownloadStatus.value = '正在下載附件，請稍候…';

        const queuedTask = await queueAttachmentDownloadTask({
            cid: props.cid,
            sourceUrl: url,
            filename,
        });

        const completedTask = await waitForAttachmentDownloadCompletion(
            queuedTask.taskId,
        );

        if (
            completedTask.status === 'completed' &&
            completedTask.localFilePath
        ) {
            attachmentDownloadStatus.value = '下載完成，正在開啟附件…';

            const opened = await openLocalAttachmentWithNativeBridge(
                completedTask.localFilePath,
                completedTask.mimeType,
            );

            if (opened) {
                return;
            }
        }

        if (completedTask.status === 'failed' && completedTask.errorMessage) {
            attachmentDownloadError.value = completedTask.errorMessage;
        }
    } catch {
        // Fallback to legacy bridge flow for compatibility when task APIs are unavailable.
    } finally {
        downloadingAttachmentKeys.value.delete(attachmentKey);
    }

    isAttachmentDownloadInProgress.value = false;
    attachmentDownloadStatus.value = '';
};

const closeAttachmentDownloadError = () => {
    attachmentDownloadError.value = null;
};

const confirmAttachmentDownload = async () => {
    const target = pendingAttachmentDownload.value;

    if (!target) {
        return;
    }

    isAttachmentConfirmOpen.value = false;
    pendingAttachmentDownload.value = null;

    try {
        await performAttachmentDownload(target.url, target.filename);
    } finally {
        isAttachmentDownloadInProgress.value = false;
        attachmentDownloadStatus.value = '';
    }
};

const onPostContentClick = async (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest('a');

    if (!anchor || !anchor.href) {
        return;
    }

    event.preventDefault();

    let href = anchor.getAttribute('href') || anchor.href;

    if (!href) {
        return;
    }

    try {
        href = new URL(href, window.location.href).toString();
    } catch {
        // ignore invalid URL conversion and use raw href
    }

    let handled = false;

    try {
        handled = await Browser.inApp(href);
    } catch {
        handled = false;
    }

    if (!handled) {
        window.open(href, '_blank', 'noopener,noreferrer');
    }
};

const createNewPost = async () => {
    if (!newPostContent.value.trim()) {
        return;
    }

    try {
        isSubmittingReply.value = true;

        await createPost(
            props.bid,
            newPostSubject.value || '回覆',
            newPostContent.value,
            undefined,
            props.nid,
        );

        newPostSubject.value = '';
        newPostContent.value = '';
        isReplyModalOpen.value = false;

        await fetchDiscuss(props.boardCid, props.bid, props.nid, {
            includeCourses: false,
        });
    } finally {
        isSubmittingReply.value = false;
    }
};

// const startEditingPost = (post: { node?: string; content?: string }) => {
//     if (!post.node) {
//         return;
//     }

//     editingPostId.value = post.node;
//     editingPostContent.value = post.content ?? '';
// };

const submitPostEdit = async () => {
    if (!editingPostId.value) {
        return;
    }

    await updatePost(editingPostId.value, undefined, editingPostContent.value);
    editingPostId.value = null;
    editingPostContent.value = '';

    await fetchDiscuss(props.boardCid, props.bid, props.nid, {
        includeCourses: false,
    });
};

// const removePost = async (postId?: string) => {
//     if (!postId) {
//         return;
//     }

//     await deletePost(postId);
//     await fetchDiscuss(props.boardCid, props.bid, props.nid, {
//         includeCourses: false,
//     });
// };

const pushPost = async (postId?: string, liked?: boolean) => {
    if (!postId) {
        return;
    }

    // 樂觀更新 UI：立刻顯示按讚/取消按讚狀態並調整推文數
    const thread = data.value?.posts;
    const post = thread?.find((item) => item.node === postId);

    if (post) {
        post.liked = !liked;
        post.push = (post.push ?? 0) + (liked ? -1 : 1);
    }

    try {
        if (liked) {
            await unlikePost(props.bid, postId);
        } else {
            await likePost(props.bid, postId);
        }
    } catch (error) {
        console.error('pushPost failed', error);
    } finally {
        // 不論成功或失敗都重新抓一次最新資料，確保最終狀態可見
        await fetchDiscuss(props.boardCid, props.bid, props.nid, {
            includeCourses: false,
            force: true,
        });
    }
};

const openWhisperModal = (
    nodeId: string | null,
    floor: number | null = null,
) => {
    whisperModalNodeId.value = nodeId;
    whisperModalFloor.value = floor;
    whisperModalContent.value = '';
    isWhisperModalOpen.value = true;
};

const closeWhisperModal = () => {
    isWhisperModalOpen.value = false;
    whisperModalNodeId.value = null;
    whisperModalContent.value = '';
};

const submitWhisper = async () => {
    if (!whisperModalNodeId.value || !whisperModalContent.value.trim()) {
        return;
    }

    try {
        isSubmittingWhisper.value = true;

        await createWhisper(
            props.bid,
            whisperModalNodeId.value,
            whisperModalContent.value.trim(),
        );

        closeWhisperModal();

        await fetchDiscuss(props.boardCid, props.bid, props.nid, {
            includeCourses: false,
            force: true,
        });
    } finally {
        isSubmittingWhisper.value = false;
    }
};

// const startEditingWhisper = (whisper: { wid?: string; content?: string }) => {
//     if (!whisper.wid) {
//         return;
//     }

//     editingWhisperId.value = whisper.wid;
//     editingWhisperContent.value = whisper.content ?? '';
// };

const submitWhisperEdit = async (nodeId: string) => {
    if (!editingWhisperId.value) {
        return;
    }

    await updateWhisper(
        editingWhisperId.value,
        props.bid,
        nodeId,
        editingWhisperContent.value,
    );
    editingWhisperId.value = null;
    editingWhisperContent.value = '';
    await fetchDiscuss(props.boardCid, props.bid, props.nid, {
        includeCourses: false,
    });
};

// const removeWhisper = async (whisperId?: string, nodeId?: string) => {
//     if (!whisperId || !nodeId) {
//         return;
//     }

//     await deleteWhisper(whisperId, props.bid, nodeId);
//     await fetchDiscuss(props.boardCid, props.bid, props.nid, {
//         includeCourses: false,
//     });
// };

const openReportModal = (nodeId: string, content: string) => {
    reportNodeId.value = nodeId;
    reportContent_.value = content;
    reportType.value = '';
    reportSuccess.value = null;
    isReportModalOpen.value = true;
};

const submitReport = async () => {
    if (!reportNodeId.value || !reportType.value) {
        return;
    }

    try {
        isSubmittingReport.value = true;
        const success = await reportContent(
            props.bid,
            reportNodeId.value,
            reportContent_.value,
            reportType.value,
        );
        reportSuccess.value = success;

        if (success) {
            setTimeout(() => {
                isReportModalOpen.value = false;
            }, 1500);
        }
    } catch {
        reportSuccess.value = false;
    } finally {
        isSubmittingReport.value = false;
    }
};

const openBlockConfirm = (poster: string, realname: string) => {
    blockTargetPoster.value = poster;
    blockTargetRealname.value = realname;
    isBlockConfirmOpen.value = true;
};

const confirmBlockUser = async () => {
    if (!blockTargetPoster.value || !blockTargetRealname.value) {
        return;
    }

    await blockUser(blockTargetPoster.value, blockTargetRealname.value);
    isBlockConfirmOpen.value = false;
};

const handleUnblockUser = async (poster: string, realname: string) => {
    await unblockUser(poster, realname);
};

onMounted(async () => {
    await Promise.all([
        fetchCourses(),
        fetchDiscuss(props.boardCid, props.bid, props.nid, {
            includeCourses: false,
        }),
        loadBlockedUsers(),
    ]);

    try {
        await setForumRead(props.boardCid, props.bid, props.nid);
    } catch (error) {
        console.error('setForumRead failed', error);
    }
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
                <BackButton
                    :href="`/courses/${encodeURIComponent(cid)}/discuss/${encodeURIComponent(boardCid)}/${encodeURIComponent(bid)}`"
                />
            </template>

            <template #right>
                <div class="flex items-center gap-3">
                    <button
                        type="button"
                        class="inline-flex items-center gap-1 rounded-xl bg-warm-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-warm-800 dark:bg-warm-800 dark:hover:bg-warm-700"
                        @click="isReplyModalOpen = true"
                    >
                        <PlusIcon class="size-4 md:size-5" />
                        <span class="sr-only md:not-sr-only"> 新增回覆 </span>
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
                    <h2 class="font-semibold">{{ threadTitle }}</h2>
                </div>

                <div
                    v-if="error"
                    class="rounded-xl border border-dashed border-rose-300 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300"
                >
                    {{ error }}
                </div>

                <div
                    v-else-if="isLoading && (!data || data.posts.length === 0)"
                    class="space-y-3"
                >
                    <div
                        v-for="row in 3"
                        :key="row"
                        class="h-24 animate-pulse rounded-xl bg-warm-100 dark:bg-zinc-700"
                    />
                </div>

                <div
                    v-else-if="data && data.posts.length > 0"
                    class="space-y-2"
                >
                    <article
                        v-for="(post, index) in data.posts"
                        :key="post.floor ?? index"
                        class="rounded-xl border border-warm-200 bg-warm-50 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-800"
                    >
                        <!-- Blocked content -->
                        <div
                            v-if="
                                post.isBlocked &&
                                post.node &&
                                !revealedPosts.has(post.node)
                            "
                            class="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
                        >
                            <div class="flex items-center gap-2">
                                <ExclamationTriangleIcon
                                    class="size-5 shrink-0"
                                />
                                <p>
                                    本內容經檢舉已在 Alt UU
                                    中隱藏，若有需要請前往其他平台檢視。原因：{{
                                        getReasonLabel(
                                            post.blockedReason ?? '',
                                        )
                                    }}。
                                </p>
                            </div>
                            <button
                                type="button"
                                class="mt-2 text-xs font-medium text-amber-600 underline hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
                                @click="revealedPosts.add(post.node)"
                            >
                                仍要檢視
                            </button>
                        </div>

                        <!-- Blocked user -->
                        <div
                            v-else-if="
                                isUserBlocked(post.poster, post.realname)
                            "
                            class="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        >
                            <p>
                                由於你封鎖了名稱為「{{
                                    post.realname
                                }}」、帳號為「{{
                                    post.poster
                                }}」的使用者，因此此內容已隱藏。
                            </p>
                            <button
                                type="button"
                                class="mt-2 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                                @click="
                                    handleUnblockUser(
                                        post.poster ?? '',
                                        post.realname ?? '',
                                    )
                                "
                            >
                                解除封鎖
                            </button>
                        </div>

                        <!-- Normal post -->
                        <template v-else>
                            <header
                                class="mb-1 flex items-center justify-between gap-2 text-sm text-warm-600 md:text-base dark:text-zinc-400"
                            >
                                <span
                                    >樓層 {{ post.floor ?? index + 1 }} ·
                                    {{ post.realname ?? post.poster ?? '匿名' }}
                                    · {{ post.postDate ?? '' }}</span
                                >
                                <div class="flex items-center gap-2">
                                    <button
                                        type="button"
                                        :class="[
                                            'inline-flex items-center gap-1 rounded border px-2 py-1 text-xs transition',
                                            post.liked
                                                ? 'border-warm-800 bg-warm-800 text-white dark:border-warm-700 dark:bg-warm-700 dark:text-zinc-100'
                                                : 'border-warm-300 bg-white text-warm-700 hover:bg-warm-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
                                        ]"
                                        @click.stop.prevent="
                                            pushPost(post.node, post.liked)
                                        "
                                    >
                                        <component
                                            :is="
                                                post.liked
                                                    ? HandThumbUpIconSolid
                                                    : HandThumbUpIconOutline
                                            "
                                            class="size-4 md:size-5"
                                        />
                                        <span>{{ post.push ?? 0 }}</span>
                                    </button>
                                </div>
                            </header>
                            <div
                                v-if="editingPostId === post.node"
                                class="mt-2"
                            >
                                <textarea
                                    v-model="editingPostContent"
                                    class="w-full rounded border border-warm-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                                    rows="4"
                                />
                                <div class="mt-2 flex gap-2">
                                    <button
                                        type="button"
                                        class="rounded-xl bg-warm-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-warm-800 dark:bg-warm-500 dark:hover:bg-warm-600"
                                        @click="submitPostEdit"
                                    >
                                        儲存
                                    </button>
                                    <button
                                        type="button"
                                        class="rounded-xl border border-warm-300 bg-white px-4 py-2 text-sm font-semibold text-warm-700 transition hover:border-warm-400 hover:bg-warm-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-500"
                                        @click="
                                            () => {
                                                editingPostId = null;
                                                editingPostContent = '';
                                            }
                                        "
                                    >
                                        取消
                                    </button>
                                </div>
                            </div>
                            <div
                                v-else
                                class="prose prose-sm mt-1 overflow-auto text-sm prose-warm select-auto md:prose-lg dark:prose-zinc dark:prose-invert"
                                v-html="
                                    adjustedContent(post.content) ||
                                    '（無內容）'
                                "
                                @click="onPostContentClick"
                            />

                            <section
                                v-if="
                                    post.attachments &&
                                    post.attachments.length > 0
                                "
                                class="mt-3 rounded-lg border border-warm-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
                            >
                                <h4
                                    class="mb-2 text-xs font-semibold text-warm-700 dark:text-zinc-300"
                                >
                                    附件 ({{ post.attachments.length }})
                                </h4>
                                <ul class="space-y-1">
                                    <li
                                        v-for="(
                                            attachment, ai
                                        ) in post.attachments"
                                        :key="
                                            attachment.href ??
                                            attachment.filename ??
                                            ai
                                        "
                                        class="flex items-center gap-2 text-sm text-warm-700 dark:text-zinc-300"
                                    >
                                        <PaperClipIcon
                                            class="h-4 w-4 shrink-0 text-warm-500 dark:text-zinc-500"
                                        />
                                        <a
                                            v-if="attachment.href"
                                            :href="attachment.href"
                                            class="underline hover:text-warm-900 dark:hover:text-zinc-300"
                                            :download="
                                                attachment.filename
                                                    ? attachment.filename
                                                    : undefined
                                            "
                                            @click.prevent="
                                                requestAttachmentDownload(
                                                    attachment.href,
                                                    attachment.filename,
                                                )
                                            "
                                        >
                                            {{
                                                attachment.filename ??
                                                attachment.href
                                            }}
                                        </a>
                                        <span v-else>
                                            {{ attachment.filename ?? '檔案' }}
                                        </span>
                                    </li>
                                </ul>
                            </section>

                            <section
                                v-if="
                                    index !== 0 ||
                                    post.whisperCount ||
                                    (post.whispers && post.whispers.length > 0)
                                "
                                class="mt-3 rounded-lg border border-warm-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
                            >
                                <div
                                    class="flex items-center justify-between"
                                    :class="{ 'mb-2': post.whisperCount }"
                                >
                                    <h4
                                        class="text-xs font-semibold text-warm-700 dark:text-zinc-300"
                                    >
                                        留言 ({{
                                            post.whisperCount ??
                                            post.whispers?.length ??
                                            0
                                        }})
                                    </h4>
                                    <button
                                        type="button"
                                        class="rounded bg-warm-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-warm-800 dark:bg-warm-800 dark:hover:bg-warm-600"
                                        @click="
                                            openWhisperModal(
                                                post.node ?? null,
                                                post.floor ?? index + 1,
                                            )
                                        "
                                    >
                                        新增留言
                                    </button>
                                </div>
                                <div class="space-y-2">
                                    <article
                                        v-for="(whisper, wi) in post.whispers ??
                                        []"
                                        :key="whisper.wid ?? whisper.sid ?? wi"
                                        class="rounded-md border border-warm-100 bg-warm-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800"
                                    >
                                        <header
                                            class="mb-1 flex flex-wrap items-center gap-2 text-sm text-warm-600 dark:text-zinc-400"
                                        >
                                            <span>{{
                                                whisper.realname ??
                                                whisper.creator ??
                                                '匿名'
                                            }}</span>
                                            <span>·</span>
                                            <span>{{
                                                whisper.createTime ?? ''
                                            }}</span>
                                        </header>

                                        <div
                                            v-if="
                                                editingWhisperId === whisper.wid
                                            "
                                        >
                                            <textarea
                                                v-model="editingWhisperContent"
                                                class="w-full rounded border border-warm-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                                                rows="3"
                                            />
                                            <div class="mt-2 flex gap-2">
                                                <button
                                                    type="button"
                                                    class="rounded-xl bg-warm-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-warm-800 dark:bg-warm-500 dark:hover:bg-warm-600"
                                                    @click="
                                                        submitWhisperEdit(
                                                            post.node ?? '',
                                                        )
                                                    "
                                                >
                                                    儲存
                                                </button>
                                                <button
                                                    type="button"
                                                    class="rounded-xl border border-warm-300 bg-white px-4 py-2 text-sm font-semibold text-warm-700 transition hover:border-warm-400 hover:bg-warm-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-500"
                                                    @click="
                                                        () => {
                                                            editingWhisperId =
                                                                null;
                                                            editingWhisperContent =
                                                                '';
                                                        }
                                                    "
                                                >
                                                    取消
                                                </button>
                                            </div>
                                        </div>

                                        <p
                                            v-else
                                            class="overflow-auto text-sm whitespace-pre-wrap text-warm-800 select-auto md:text-base dark:text-zinc-200"
                                        >
                                            {{
                                                whisper.content ?? '（無內容）'
                                            }}
                                        </p>
                                    </article>
                                </div>
                            </section>

                            <!-- Report / Block actions -->
                            <div
                                class="mt-2 flex items-center gap-2 border-t border-warm-200 pt-2 dark:border-zinc-700"
                            >
                                <button
                                    v-if="post.node"
                                    type="button"
                                    class="inline-flex items-center gap-1 rounded border border-warm-300 bg-white px-2 py-1 text-xs text-warm-600 transition hover:bg-warm-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                    @click="
                                        openReportModal(
                                            post.node,
                                            post.content ?? '',
                                        )
                                    "
                                >
                                    <FlagIcon class="size-3.5" />
                                    檢舉
                                </button>
                                <button
                                    v-if="post.poster && post.realname"
                                    type="button"
                                    class="inline-flex items-center gap-1 rounded border border-warm-300 bg-white px-2 py-1 text-xs text-warm-600 transition hover:bg-warm-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                    @click="
                                        openBlockConfirm(
                                            post.poster,
                                            post.realname,
                                        )
                                    "
                                >
                                    <NoSymbolIcon class="size-3.5" />
                                    封鎖使用者
                                </button>
                            </div>
                        </template>
                    </article>
                </div>

                <div
                    v-else
                    class="rounded-xl border border-dashed border-warm-300 bg-warm-50 p-4 text-sm text-warm-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                    目前沒有可顯示的討論內容。
                </div>
            </div>
        </section>

        <DiscussComposeModal
            v-model="isReplyModalOpen"
            title="新增回覆"
            context-label="回覆文章"
            :context-value="threadTitle"
            submit-label="送出回覆"
            :is-submitting="isSubmittingReply"
            @submit="createNewPost"
        >
            <input
                v-model="newPostSubject"
                class="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-warm-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                type="text"
                placeholder="主題（選填）"
            />
            <textarea
                v-model="newPostContent"
                class="h-36 w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-warm-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                placeholder="內容"
            />
        </DiscussComposeModal>

        <DiscussComposeModal
            v-model="isWhisperModalOpen"
            title="新增留言"
            context-label="留言於"
            :context-value="
                whisperModalFloor ? `樓層 ${whisperModalFloor}` : threadTitle
            "
            submit-label="送出留言"
            :is-submitting="isSubmittingWhisper"
            @submit="submitWhisper"
        >
            <textarea
                v-model="whisperModalContent"
                class="h-24 w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-warm-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                placeholder="留言內容"
            />
        </DiscussComposeModal>

        <!-- Report Modal -->
        <ReportModal
            :is-open="isReportModalOpen"
            :report-node-id="reportNodeId"
            :report-content="reportContent_"
            :report-type="reportType"
            :is-submitting="isSubmittingReport"
            :report-success="reportSuccess"
            @update:is-open="isReportModalOpen = $event"
            @update:report-type="reportType = $event"
            @submit="submitReport"
        />

        <Teleport to="body">
            <div
                v-if="isAttachmentConfirmOpen"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                @click.self="closeAttachmentConfirm"
            >
                <div
                    class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
                >
                    <h3
                        class="mb-3 text-lg font-semibold text-warm-900 dark:text-zinc-100"
                    >
                        下載附件
                    </h3>
                    <p class="text-sm text-warm-600 dark:text-zinc-400">
                        確定要下載並開啟「{{
                            pendingAttachmentDownload?.filename ?? '此附件'
                        }}」嗎？
                    </p>
                    <div class="mt-4 flex justify-end gap-2">
                        <button
                            type="button"
                            class="rounded-xl border border-warm-300 bg-white px-4 py-2 text-sm font-semibold text-warm-700 transition hover:bg-warm-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                            @click="closeAttachmentConfirm"
                        >
                            取消
                        </button>
                        <button
                            type="button"
                            class="rounded-xl bg-warm-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-warm-800 dark:bg-warm-800 dark:hover:bg-warm-700"
                            @click="confirmAttachmentDownload"
                        >
                            確認下載
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <Teleport to="body">
            <div
                v-if="isAttachmentDownloadInProgress"
                class="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/50 p-6 backdrop-blur-sm"
            >
                <div
                    class="w-full max-w-xs rounded-2xl border border-warm-200 bg-white/95 px-5 py-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900/95"
                >
                    <div class="flex items-center gap-3">
                        <span
                            class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-warm-600 border-r-transparent dark:border-zinc-100 dark:border-r-transparent"
                            aria-hidden="true"
                        />
                        <div>
                            <p
                                class="text-sm font-semibold text-warm-900 dark:text-zinc-100"
                            >
                                正在處理附件
                            </p>
                            <p
                                class="mt-1 text-xs text-warm-600 dark:text-zinc-400"
                            >
                                {{ attachmentDownloadStatus }}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Block User Confirmation -->
        <Teleport to="body">
            <div
                v-if="isBlockConfirmOpen"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                @click.self="isBlockConfirmOpen = false"
            >
                <div
                    class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
                >
                    <h3
                        class="mb-3 text-lg font-semibold text-warm-900 dark:text-zinc-100"
                    >
                        封鎖使用者
                    </h3>
                    <p class="text-sm text-warm-600 dark:text-zinc-400">
                        確定要封鎖名稱為「{{
                            blockTargetRealname
                        }}」、帳號為「{{
                            blockTargetPoster
                        }}」的使用者嗎？封鎖後，所有相同名稱使用者的所有貼文將被隱藏。
                    </p>
                    <div class="mt-4 flex justify-end gap-2">
                        <button
                            type="button"
                            class="rounded-xl border border-warm-300 bg-white px-4 py-2 text-sm font-semibold text-warm-700 transition hover:bg-warm-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                            @click="isBlockConfirmOpen = false"
                        >
                            取消
                        </button>
                        <button
                            type="button"
                            class="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600"
                            @click="confirmBlockUser"
                        >
                            確定封鎖
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Attachment Download Error -->
        <Teleport to="body">
            <div
                v-if="attachmentDownloadError"
                class="fixed inset-0 z-80 flex items-center justify-center bg-black/40 p-4"
                @click.self="closeAttachmentDownloadError"
            >
                <div
                    class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
                >
                    <h3
                        class="mb-3 text-lg font-semibold text-warm-900 dark:text-zinc-100"
                    >
                        下載失敗
                    </h3>
                    <p class="text-sm text-warm-600 dark:text-zinc-400">
                        {{ attachmentDownloadError }}
                    </p>
                    <div class="mt-4 flex justify-end">
                        <button
                            type="button"
                            class="rounded-xl bg-warm-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-warm-800 dark:bg-warm-800 dark:hover:bg-warm-700"
                            @click="closeAttachmentDownloadError"
                        >
                            確定
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <AndroidBottomControlBackground />
    </AppLayout>
</template>
