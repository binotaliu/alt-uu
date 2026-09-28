<script setup lang="ts">
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ClockIcon,
} from '@heroicons/vue/24/outline';
import { ref, onMounted, watch, computed, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { Browser, Network } from '#nativephp';
import AndroidBottomControlBackground from '@/components/AndroidBottomControlBackground.vue';
import AppLayout from '@/components/AppLayout.vue';
import BackButton from '@/components/BackButton.vue';
import ErrorRetry from '@/components/ErrorRetry.vue';
import MaterialDirectory from '@/components/MaterialDirectory.vue';
import MaterialViewer from '@/components/MaterialViewer.vue';
import PageHeader from '@/components/PageHeader.vue';
import {
    useCoursePath,
    useNodeResources,
    useParsedContent,
    useCourseLearningTimes,
    useLastSeenMaterial,
} from '@/composables/useCoursePath';
import { useCourses } from '@/composables/useCourses';
import { useStudyTimer } from '@/composables/useStudyTimer';
import { useTitle } from '@/composables/useTitle';
import { openTronclassUrl } from '@/lib/nativeAttachment';
import { getNativeMediaState } from '@/lib/nativeMediaPlayer';
import { navigateBack } from '@/router';
import { useAppConfigStore } from '@/stores/appConfig';
import type { MaterialNode } from '@/types';

useTitle('學習中');

const vueRouter = useRouter();
const configStore = useAppConfigStore();
const props = defineProps<{
    cid: string;
    scoid: string;
}>();

const { courses, fetchCourses } = useCourses();
const {
    materialNodes,
    isLoading: isPathLoading,
    fetchPath,
} = useCoursePath(props.cid);
const {
    resources,
    error: resourcesError,
    errorDetail: resourcesErrorDetail,
    fetchResources,
} = useNodeResources();
const {
    content,
    error: contentError,
    errorDetail: contentErrorDetail,
    fetchContent,
    refreshContent,
    fetchParsedContent,
} = useParsedContent();
const {
    viewingSeconds,
    startedAt,
    isSaving,
    startTracking,
    stopTimer,
    formatSeconds,
    sendStudyTime,
    sendStudyTimeBeacon,
    updatePlaybackPosition,
    updateMediaDuration,
} = useStudyTimer(
    props.cid,
    async () => (await viewerRef.value?.getCurrentTime()) ?? 0,
    async () => (await viewerRef.value?.getDuration()) ?? 0,
);

const { items: learningTimeItems, fetchLearningTimes } = useCourseLearningTimes(
    props.cid,
);
const {
    activityId: lastSeenActivityId,
    positionSeconds: lastSeenPositionSeconds,
    mediaDurationSeconds: lastSeenDurationSeconds,
    fetchLastSeenMaterial,
} = useLastSeenMaterial(props.cid);

const activeNodeIdentifier = ref<string>(props.scoid);
const isContentLoading = ref(true);
const viewerRef = ref<InstanceType<typeof MaterialViewer> | null>(null);
const restoredStartedAt = ref<string | null>(null);

// Resume prompt state
const resumePrompt = ref<{ position: number; label: string } | null>(null);

// Cellular playback confirmation state
const cellularPrompt = ref(false);
const cellularPromptDontAskAgain = ref(false);
let cellularPromptResolve: ((allowed: boolean) => void) | null = null;

const selectedCourse = computed(
    () => courses.value.find((c) => c.courseId === props.cid) ?? null,
);

const courseTitle = computed(
    () => selectedCourse.value?.name || `課程 ${props.cid}`,
);

const activeNode = computed<MaterialNode | null>(
    () =>
        materialNodes.value.find(
            (n) => n.identifier === activeNodeIdentifier.value,
        ) ?? null,
);

const activeNodeText = computed(() => activeNode.value?.text || '');

const navigableNodes = computed(() =>
    materialNodes.value.filter((n) => n.leaf && n.href && !n.itemDisabled),
);

const activeNavIndex = computed(() =>
    navigableNodes.value.findIndex(
        (n) => n.identifier === activeNodeIdentifier.value,
    ),
);

const previousMaterialNode = computed<MaterialNode | null>(() => {
    const index = activeNavIndex.value;

    return index > 0 ? navigableNodes.value[index - 1] : null;
});

const nextMaterialNode = computed<MaterialNode | null>(() => {
    const index = activeNavIndex.value;

    if (index < 0 || index >= navigableNodes.value.length - 1) {
        return null;
    }

    return navigableNodes.value[index + 1];
});

const activeNodeHref = computed(() => activeNode.value?.href || null);

const activeMaterialRoutePath = computed(
    () =>
        `/courses/${encodeURIComponent(props.cid)}/${encodeURIComponent(activeNodeIdentifier.value)}`,
);

const nativeSessionContext = computed(() => {
    if (
        !activeNodeIdentifier.value ||
        !activeNodeHref.value ||
        !startedAt.value
    ) {
        return null;
    }

    return {
        routePath: activeMaterialRoutePath.value,
        cid: props.cid,
        activityId: activeNodeIdentifier.value,
        href: activeNodeHref.value,
        startedAt: startedAt.value,
    };
});

const MIN_RESUME_POSITION_SECONDS = 3;
const NATIVE_BACK_PRESSED_EVENT = 'nativephp:back-pressed';

const isAudioCourse = computed(() => {
    if (selectedCourse.value?.courseType !== '語音') {
        return false;
    }

    if (
        activeNodeText.value?.includes('錄影') &&
        activeNodeText.value?.includes('面授')
    ) {
        return false;
    }

    return true;
});

const isTabletOrAbove = ref(false);

function checkScreenSize() {
    isTabletOrAbove.value = window.matchMedia('(min-width: 768px)').matches;
}

async function loadNodeData(scoid: string): Promise<boolean> {
    isContentLoading.value = true;
    let proceed = true;

    try {
        await Promise.all([
            fetchResources(props.cid, scoid),
            fetchContent(props.cid, scoid),
        ]);

        if (content.value?.videoUrl || content.value?.embedVideoUrl) {
            proceed = await ensureCellularPlaybackAllowed();
        }
    } finally {
        isContentLoading.value = false;
    }

    if (!proceed) {
        vueRouter.replace(`/courses/${encodeURIComponent(props.cid)}`);
    }

    return proceed;
}

async function reloadNodeContent(): Promise<boolean> {
    const scoid = activeNodeIdentifier.value;
    const [contentOk] = await Promise.all([
        refreshContent(props.cid, scoid),
        fetchResources(props.cid, scoid),
    ]);

    return contentOk;
}

async function retryLoadNodeData(): Promise<void> {
    await loadNodeData(activeNodeIdentifier.value);
}

function consumeRestoredStartedAt(): string | null {
    const value = restoredStartedAt.value;

    restoredStartedAt.value = null;

    return value;
}

async function loadNativeRestoreState(): Promise<void> {
    const state = await getNativeMediaState();
    const routePath = state?.sessionContext?.routePath;
    const activityId = state?.sessionContext?.activityId;
    const startedAtValue = state?.sessionContext?.startedAt;

    if (
        !state?.isActive ||
        typeof routePath !== 'string' ||
        routePath !== activeMaterialRoutePath.value ||
        activityId !== activeNodeIdentifier.value ||
        typeof startedAtValue !== 'string' ||
        startedAtValue.trim() === ''
    ) {
        restoredStartedAt.value = null;

        return;
    }

    restoredStartedAt.value = startedAtValue;
}

function formatSecondsLabel(total: number): string {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = Math.floor(total % 60);

    if (h > 0) {
        return `${h} 時 ${m.toString().padStart(2, '0')} 分 ${s.toString().padStart(2, '0')} 秒`;
    }

    if (m > 0) {
        return `${m} 分 ${s.toString().padStart(2, '0')} 秒`;
    }

    return `${s} 秒`;
}

async function checkPlaybackProgress(identifier: string): Promise<void> {
    // The progress check is tied to the node identifier, not strictly its href.
    // Some nodes may share href but have separate progress records.
    resumePrompt.value = null;

    try {
        const res = await fetch(
            `/api/playback-progress/${encodeURIComponent(props.cid)}/${encodeURIComponent(identifier)}`,
            { headers: { Accept: 'application/json' } },
        );

        if (!res.ok) {
            return;
        }

        const data = await res.json();
        const position = Number(data?.progress?.positionSeconds ?? 0);

        if (
            !Number.isNaN(position) &&
            position >= MIN_RESUME_POSITION_SECONDS
        ) {
            resumePrompt.value = {
                position,
                label: formatSecondsLabel(position),
            };
        }
    } catch {
        resumePrompt.value = null;
    }
}

function handleResumeConfirm(): void {
    const pos = resumePrompt.value?.position;
    resumePrompt.value = null;

    if (pos && pos > 0) {
        void viewerRef.value?.seekTo(pos);
    }
}

function handleResumeDismiss(): void {
    resumePrompt.value = null;
}

async function ensureCellularPlaybackAllowed(): Promise<boolean> {
    if (!configStore.cellularPlaybackWarningEnabled) {
        return true;
    }

    let status: { connected: boolean; type?: string } | null = null;

    try {
        status = await Network.status();
    } catch {
        return true;
    }

    if (!status || status.type !== 'cellular') {
        return true;
    }

    cellularPromptDontAskAgain.value = false;
    cellularPrompt.value = true;

    return new Promise<boolean>((resolve) => {
        cellularPromptResolve = resolve;
    });
}

async function resolveCellularPrompt(allowed: boolean): Promise<void> {
    cellularPrompt.value = false;

    if (cellularPromptDontAskAgain.value) {
        try {
            await configStore.updatePreferences({
                cellularPlaybackWarningEnabled: false,
            });
        } catch {
            // Ignore; the user will simply be asked again next time.
        }
    }

    cellularPromptResolve?.(allowed);
    cellularPromptResolve = null;
}

async function reloadSession(): Promise<boolean> {
    try {
        const response = await fetch('/api/auth/bootstrap-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({}),
        });

        return response.ok;
    } catch {
        return false;
    }
}

async function saveStudyTimeWithRetry(
    identifier: string,
    href: string,
): Promise<boolean> {
    let success = await sendStudyTime(identifier, href);

    if (success) {
        if (viewerRef.value?.closePlayer) {
            await viewerRef.value.closePlayer();
        }

        return true;
    }

    const sessionReloaded = await reloadSession();

    if (!sessionReloaded) {
        return false;
    }

    success = await sendStudyTime(identifier, href);

    if (viewerRef.value?.closePlayer) {
        await viewerRef.value.closePlayer();
    }

    return success;
}

async function handleNodeSelect(identifier: string) {
    if (identifier === activeNodeIdentifier.value) {
        return;
    }

    const prevNode = activeNode.value;

    if (prevNode?.identifier && prevNode?.href) {
        isSaving.value = true;
        await saveStudyTimeWithRetry(prevNode.identifier, prevNode.href);
        isSaving.value = false;
    }

    activeNodeIdentifier.value = identifier;

    vueRouter.replace(
        `/courses/${encodeURIComponent(props.cid)}/${encodeURIComponent(identifier)}`,
    );
}

async function goToPreviousMaterial() {
    if (previousMaterialNode.value) {
        await handleNodeSelect(previousMaterialNode.value.identifier);
    }
}

async function goToNextMaterial() {
    if (nextMaterialNode.value) {
        await handleNodeSelect(nextMaterialNode.value.identifier);
    }
}

async function handleContentLinkClick(href: string) {
    const node = materialNodes.value.find((n) => {
        if (!n.href) {
            return false;
        }

        try {
            const nodeUrl = new URL(n.href);
            const targetUrl = new URL(href);

            return (
                nodeUrl.host === targetUrl.host &&
                nodeUrl.pathname === targetUrl.pathname &&
                nodeUrl.search === targetUrl.search
            );
        } catch {
            return false;
        }
    });

    if (node) {
        if (node.identifier === activeNodeIdentifier.value) {
            // Special case: link points back to the current node’s URL.
            // This can happen when the current node is treated as a "multi-page" material.
            // Reload the node’s content without resetting the study timer.
            isContentLoading.value = true;

            try {
                await loadNodeData(node.identifier);
            } finally {
                isContentLoading.value = false;
            }

            return;
        }

        await handleNodeSelect(node.identifier);

        return;
    }

    // Special case: same host as current node, but not a known node URL.
    // Treat this as a “sub-page” of the active node, keep study timer running,
    // and load the parsed content for this URL.
    if (activeNodeHref.value) {
        try {
            const activeUrl = new URL(activeNodeHref.value);
            const targetUrl = new URL(href);

            if (activeUrl.host === targetUrl.host) {
                isContentLoading.value = true;

                try {
                    await fetchParsedContent(href);
                } finally {
                    isContentLoading.value = false;
                }

                return;
            }
        } catch {
            // ignore malformed URLs and fall back to opening in a new tab
        }
    }

    if (
        href.startsWith('https://tronclass.nou.edu.tw/') ||
        href.startsWith('https://nou.tronclass.com.tw/')
    ) {
        const target = `tronclass://navigate?url=${encodeURIComponent(href)}`;

        const opened = await openTronclassUrl(target);

        if (opened) {
            return;
        }
    }

    Browser.inApp(href);
}

async function handleBack() {
    if (isSaving.value) {
        return;
    }

    isSaving.value = true;
    const node = activeNode.value;

    if (node?.identifier && node?.href) {
        await saveStudyTimeWithRetry(node.identifier, node.href);
    }

    isSaving.value = false;

    stopTimer();

    navigateBack(`/courses/${encodeURIComponent(props.cid)}`);
}

function handleNativeBackPressed(event: Event): void {
    event.preventDefault();
    void handleBack();
}

function handlePageLeave(): void {
    const node = activeNode.value;
    const href = node?.href;

    if (!node?.identifier || !href) {
        return;
    }

    const updateAndSend = async (): Promise<void> => {
        try {
            const currentTime = await viewerRef.value?.getCurrentTime();

            if (typeof currentTime === 'number' && currentTime > 0) {
                updatePlaybackPosition(currentTime);
            }

            const duration = await viewerRef.value?.getDuration();

            if (typeof duration === 'number') {
                updateMediaDuration(duration);
            }
        } finally {
            sendStudyTimeBeacon(node.identifier, href);
        }
    };

    void updateAndSend();
}

watch(activeNodeIdentifier, async (scoid) => {
    if (!scoid) {
        resumePrompt.value = null;

        return;
    }

    const proceed = await loadNodeData(scoid);

    if (!proceed) {
        return;
    }

    const isNativeRestore = restoredStartedAt.value !== null;
    startTracking(!!activeNodeHref.value, consumeRestoredStartedAt());
    resumePrompt.value = null;
    // Reload learning times when active node changes (update sidebar durations)
    fetchLearningTimes();

    if (!isNativeRestore) {
        await checkPlaybackProgress(scoid);
    }
});

watch(activeNodeHref, (href) => {
    startTracking(!!href, startedAt.value);
    resumePrompt.value = null;
});

// When switching to tablet layout, ensure learning times are loaded so sidebar shows durations
watch(isTabletOrAbove, (val) => {
    if (val) {
        fetchLearningTimes();
    }
});

onMounted(async () => {
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    window.addEventListener('pagehide', handlePageLeave);
    window.addEventListener(NATIVE_BACK_PRESSED_EVENT, handleNativeBackPressed);

    await Promise.all([
        fetchCourses(),
        fetchPath(),
        fetchLastSeenMaterial(),
        configStore.loadConfig(),
        configStore.loadPreferences(),
    ]);
    await loadNativeRestoreState();

    // If this is tablet (iPad) or larger, load learning times to show durations in the sidebar
    if (isTabletOrAbove.value) {
        fetchLearningTimes();
    }

    if (props.scoid) {
        const proceed = await loadNodeData(props.scoid);

        if (proceed) {
            const isNativeRestore = restoredStartedAt.value !== null;
            startTracking(!!activeNodeHref.value, consumeRestoredStartedAt());

            if (activeNodeHref.value && !isNativeRestore) {
                void checkPlaybackProgress(props.scoid);
            }
        }
    }
});

onUnmounted(() => {
    window.removeEventListener('resize', checkScreenSize);
    window.removeEventListener('pagehide', handlePageLeave);
    window.removeEventListener(
        NATIVE_BACK_PRESSED_EVENT,
        handleNativeBackPressed,
    );
});
</script>

<template>
    <AppLayout>
        <PageHeader
            :title="courseTitle"
            :subtitle="activeNodeText || '檢視教材'"
            :showLeftSlot="!!activeNodeIdentifier"
            :isLoading="isPathLoading || isContentLoading || !selectedCourse"
            @back="handleBack"
        >
            <template #left>
                <BackButton v-if="activeNodeIdentifier" @click="handleBack" />
            </template>

            <template #right>
                <div
                    v-if="activeNodeHref"
                    class="inline-flex shrink-0 items-center gap-2"
                >
                    <div
                        class="inline-flex items-center gap-2 rounded-full bg-theme-100 px-3 py-1 text-xs font-medium text-theme-800 md:text-sm lg:text-base dark:bg-zinc-700 dark:text-zinc-200"
                    >
                        <ClockIcon class="h-4 w-4" />
                        <span class="sr-only">學習計時</span>
                        <span class="tabular-nums">{{
                            formatSeconds(viewingSeconds)
                        }}</span>
                    </div>
                </div>
            </template>
        </PageHeader>

        <div class="px-3 pt-4 pb-24 sm:px-4 md:pb-6">
            <div
                class="grid gap-4 md:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]"
            >
                <aside
                    v-if="isTabletOrAbove || !activeNodeIdentifier"
                    class="md:sticky md:top-[calc(var(--inset-top,0px)+6.25rem)] md:h-[calc(100vh-var(--inset-top,0px)-var(--inset-bottom,0px)-8rem)]"
                >
                    <div
                        class="h-full overflow-hidden rounded-2xl border border-theme-200 bg-white/85 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/85"
                    >
                        <MaterialDirectory
                            :selected-cid="cid"
                            :material-nodes="materialNodes"
                            :learning-time-items="learningTimeItems"
                            :active-node-identifier="activeNodeIdentifier"
                            :last-seen-identifier="lastSeenActivityId"
                            :last-seen-position-seconds="
                                lastSeenPositionSeconds
                            "
                            :last-seen-duration-seconds="
                                lastSeenDurationSeconds
                            "
                            :is-loading="isPathLoading"
                            node-select-mode="event"
                            @node-select="handleNodeSelect"
                        />
                    </div>
                </aside>

                <section class="min-w-0">
                    <div v-if="isContentLoading" class="space-y-3">
                        <div
                            class="aspect-video w-full animate-pulse rounded-2xl bg-theme-200 dark:bg-zinc-700"
                        />
                        <div
                            class="space-y-2 rounded-2xl border border-theme-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
                        >
                            <div
                                class="h-4 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
                                style="width: 75%"
                            />
                            <div
                                class="h-4 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
                                style="width: 55%"
                            />
                            <div
                                class="h-4 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
                                style="width: 90%"
                            />
                        </div>
                    </div>
                    <ErrorRetry
                        v-else-if="contentError || resourcesError"
                        :message="
                            contentError || resourcesError || '載入教材失敗'
                        "
                        :detail="contentErrorDetail ?? resourcesErrorDetail"
                        :retrying="isContentLoading"
                        @retry="retryLoadNodeData"
                    />
                    <MaterialViewer
                        v-else
                        ref="viewerRef"
                        :video-url="content?.videoUrl ?? null"
                        :subtitle-url="content?.subtitleUrl ?? null"
                        :video-provider="content?.videoProvider ?? 'native'"
                        :embed-video-url="content?.embedVideoUrl ?? null"
                        :download-url="content?.downloadUrl ?? null"
                        :download-proxy-url="content?.downloadProxyUrl ?? null"
                        :download-file-name="content?.downloadFileName ?? null"
                        :download-file-extension="
                            content?.downloadFileExtension ?? null
                        "
                        :is-pdf="content?.isPdf ?? false"
                        :html-content="content?.htmlContent ?? null"
                        :is-audio-course="isAudioCourse"
                        :resources="resources"
                        :active-node-text="activeNodeText"
                        :course-title="courseTitle"
                        :selected-cid="cid"
                        :in-app-url="activeNodeHref"
                        :native-session-context="nativeSessionContext"
                        :reload-content="reloadNodeContent"
                        :prefer-web-player="
                            configStore.screenReaderEnhancedSupportEnabled
                        "
                        @content-link-click="handleContentLinkClick"
                        @now-playing-update="
                            (elapsed) => updatePlaybackPosition(elapsed)
                        "
                    />

                    <div
                        v-if="
                            !isContentLoading &&
                            (previousMaterialNode || nextMaterialNode)
                        "
                        class="mt-4 grid grid-cols-2 gap-3"
                    >
                        <button
                            type="button"
                            class="group flex min-w-0 items-start gap-2 rounded-2xl border border-theme-200 bg-white p-3 text-left transition hover:border-theme-400 hover:bg-theme-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-theme-200 disabled:hover:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:disabled:hover:border-zinc-700 dark:disabled:hover:bg-zinc-900"
                            :disabled="!previousMaterialNode"
                            @click="goToPreviousMaterial"
                        >
                            <ChevronLeftIcon
                                class="mt-0.5 h-4 w-4 shrink-0 text-theme-700 group-disabled:text-theme-400 dark:text-zinc-400"
                            />
                            <div class="min-w-0">
                                <p
                                    class="text-xs font-medium text-theme-700 dark:text-zinc-400"
                                >
                                    上一個教材
                                </p>
                                <p
                                    class="line-clamp-2 text-sm font-semibold text-theme-900 dark:text-zinc-100"
                                >
                                    {{ previousMaterialNode?.text || '無' }}
                                </p>
                            </div>
                        </button>

                        <button
                            type="button"
                            class="group flex min-w-0 items-start justify-end gap-2 rounded-2xl border border-theme-200 bg-white p-3 text-right transition hover:border-theme-400 hover:bg-theme-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-theme-200 disabled:hover:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:disabled:hover:border-zinc-700 dark:disabled:hover:bg-zinc-900"
                            :disabled="!nextMaterialNode"
                            @click="goToNextMaterial"
                        >
                            <div class="min-w-0">
                                <p
                                    class="text-xs font-medium text-theme-700 dark:text-zinc-400"
                                >
                                    下一個教材
                                </p>
                                <p
                                    class="line-clamp-2 text-sm font-semibold text-theme-900 dark:text-zinc-100"
                                >
                                    {{ nextMaterialNode?.text || '無' }}
                                </p>
                            </div>
                            <ChevronRightIcon
                                class="mt-0.5 h-4 w-4 shrink-0 text-theme-700 group-disabled:text-theme-400 dark:text-zinc-400"
                            />
                        </button>
                    </div>
                </section>
            </div>
        </div>

        <Teleport to="body">
            <transition name="slide-down" appear>
                <div
                    v-if="isSaving"
                    class="fixed inset-0 z-80 flex items-start justify-center p-4 pt-[calc(var(--inset-top,0px)+.5rem)]"
                >
                    <div
                        key="saving"
                        class="w-full max-w-md rounded-2xl border border-theme-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95"
                    >
                        <div class="flex items-center gap-3">
                            <span
                                class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-theme-700 border-r-transparent dark:border-zinc-100 dark:border-r-transparent"
                                aria-hidden="true"
                            />
                            <div class="text-left">
                                <p
                                    class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                                >
                                    正在保存學習進度
                                </p>
                                <p
                                    class="text-xs text-theme-700 dark:text-zinc-400"
                                >
                                    已儲存最新位置，請稍候…
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </transition>

            <transition name="slide-up" appear>
                <div v-if="resumePrompt" class="fixed inset-0 z-80">
                    <div
                        class="absolute inset-0 bg-black/45 backdrop-blur-xs"
                    />
                    <div
                        class="relative z-10 flex h-full items-end justify-center px-4 pb-[max(var(--inset-bottom,0px),1.5rem)]"
                    >
                        <div
                            class="w-full max-w-sm rounded-2xl border border-theme-200 bg-white px-5 py-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
                        >
                            <p
                                class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                            >
                                接續上次播放？
                            </p>
                            <p
                                class="mt-1 text-sm text-theme-700 dark:text-zinc-400"
                            >
                                上次播放到
                                <span
                                    class="font-medium text-theme-900 dark:text-zinc-100"
                                    >{{ resumePrompt.label }}</span
                                >，是否從此處繼續？
                            </p>
                            <div class="mt-4 flex gap-3">
                                <button
                                    type="button"
                                    class="flex-1 rounded-xl bg-theme-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-theme-700"
                                    @click="handleResumeConfirm"
                                >
                                    接續播放
                                </button>
                                <button
                                    type="button"
                                    class="flex-1 rounded-xl border border-theme-200 px-4 py-2.5 text-sm font-medium text-theme-700 transition hover:border-theme-400 dark:border-zinc-700 dark:text-zinc-300"
                                    @click="handleResumeDismiss"
                                >
                                    從頭開始
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </transition>

            <transition name="slide-up" appear>
                <div v-if="cellularPrompt" class="fixed inset-0 z-80">
                    <div
                        class="absolute inset-0 bg-black/45 backdrop-blur-xs"
                    />
                    <div
                        class="relative z-10 flex h-full items-end justify-center px-4 pb-[max(var(--inset-bottom,0px),1.5rem)]"
                    >
                        <div
                            class="w-full max-w-sm rounded-2xl border border-theme-200 bg-white px-5 py-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
                        >
                            <p
                                class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                            >
                                使用行動網路播放？
                            </p>
                            <p
                                class="mt-1 text-sm text-theme-700 dark:text-zinc-400"
                            >
                                您目前透過行動網路（非
                                Wi-Fi）連線，播放教材影音可能會消耗較多行動數據，是否繼續播放？
                            </p>
                            <label
                                class="mt-3 flex items-center gap-2 text-sm text-theme-700 dark:text-zinc-300"
                            >
                                <input
                                    v-model="cellularPromptDontAskAgain"
                                    type="checkbox"
                                    class="size-4 rounded border-theme-300 text-theme-700 focus:ring-theme-500 dark:border-zinc-600 dark:text-theme-500"
                                />
                                不再詢問（可於設定頁面重新開啟）
                            </label>
                            <div class="mt-4 flex gap-3">
                                <button
                                    type="button"
                                    class="flex-1 rounded-xl bg-theme-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-theme-700"
                                    @click="resolveCellularPrompt(true)"
                                >
                                    繼續播放
                                </button>
                                <button
                                    type="button"
                                    class="flex-1 rounded-xl border border-theme-200 px-4 py-2.5 text-sm font-medium text-theme-700 transition hover:border-theme-400 dark:border-zinc-700 dark:text-zinc-300"
                                    @click="resolveCellularPrompt(false)"
                                >
                                    返回課程
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </transition>
        </Teleport>

        <AndroidBottomControlBackground />
    </AppLayout>
</template>

<style scoped>
.slide-down-enter-from,
.slide-down-leave-to {
    transform: translateY(-18px);
    opacity: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
    transform: translateY(0);
    opacity: 1;
}

.slide-down-enter-active,
.slide-down-leave-active {
    transition:
        transform 220ms ease,
        opacity 220ms ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
    transform: translateY(18px);
    opacity: 0;
}

.slide-up-enter-to,
.slide-up-leave-from {
    transform: translateY(0);
    opacity: 1;
}

.slide-up-enter-active,
.slide-up-leave-active {
    transition:
        transform 220ms ease,
        opacity 220ms ease;
}
</style>
