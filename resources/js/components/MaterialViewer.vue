<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { Browser } from '#nativephp';
import { apiFetch } from '@/composables/useApi';
import { useIsDark } from '@/composables/useIsDark';
import { processHtmlForColorScheme } from '@/lib/htmlColorScheme';
import {
    isNativeAttachmentBridgeAvailable,
    openLocalAttachmentWithNativeBridge,
    openUrlInNativeBrowser,
    queueAttachmentDownloadTask,
    waitForAttachmentDownloadCompletion,
} from '@/lib/nativeAttachment';
import {
    isNativeMediaBridgeAvailable,
    setNativeMediaPlayer,
    stopNativeMediaPlayer,
    getNativeMediaCurrentTime,
} from '@/lib/nativeMediaPlayer';
import type {
    NativeMediaSessionContext,
    NativeAppearanceMode,
    NativeMediaType,
} from '@/lib/nativeMediaPlayer';
import type { MaterialResource } from '@/types';

const props = defineProps<{
    videoUrl: string | null;
    subtitleUrl: string | null;
    downloadUrl: string | null;
    downloadProxyUrl: string | null;
    downloadFileName: string | null;
    downloadFileExtension: string | null;
    isPdf: boolean;
    htmlContent: string | null;
    isAudioCourse: boolean;
    resources: MaterialResource[];
    activeNodeText: string;
    courseTitle: string;
    selectedCid: string;
    inAppUrl: string | null;
    nativeSessionContext: NativeMediaSessionContext | null;
    preferWebPlayer: boolean;
}>();

const emit = defineEmits<{
    contentLinkClick: [href: string];
    nowPlayingUpdate: [elapsed: number, playbackRate: number];
}>();

const FONT_SCALE_DEFAULT = 1;
const FONT_SCALE_STEP = 0.1;
const FONT_SCALE_MIN = 0.7;
const FONT_SCALE_MAX = 1.6;
const FONT_SCALE_ENDPOINT = '/api/preferences/material-font-scale';

const fontScale = ref(FONT_SCALE_DEFAULT);
const isSavingFontScale = ref(false);
const isOpeningInAppBrowser = ref(false);
const isDownloadingFile = ref(false);
const downloadError = ref<string | null>(null);
const trimmedHtmlContent = computed(() => (props.htmlContent ?? '').trim());
const hasHtmlContent = computed(() => trimmedHtmlContent.value !== '');
const hasDownloadableContent = computed(() => !!props.downloadUrl);
const { isDark } = useIsDark();
const processedHtmlContent = computed(() =>
    processHtmlForColorScheme(trimmedHtmlContent.value, isDark.value),
);
const fontScaleStyle = computed(() => ({ fontSize: `${fontScale.value}rem` }));
const scaleLabel = computed(() => `${Math.round(fontScale.value * 100)}%`);
const canZoomOut = computed(() => fontScale.value > FONT_SCALE_MIN + 1e-6);
const canZoomIn = computed(() => fontScale.value < FONT_SCALE_MAX - 1e-6);
const nativePlayerHost = ref<HTMLElement | null>(null);
const usesNativeMediaPlayer = ref(false);
const nativePlayerError = ref<string | null>(null);

let nativePlayerSyncTimer: ReturnType<typeof setTimeout> | null = null;
let systemAppearanceChangeMediaQuery: MediaQueryList | null = null;

function getCurrentAppearanceMode(): NativeAppearanceMode {
    const appearance =
        typeof window !== 'undefined'
            ? (window as Window & { appearance?: unknown }).appearance
            : undefined;

    if (
        appearance === 'light' ||
        appearance === 'dark' ||
        appearance === 'system'
    ) {
        return appearance;
    }

    return 'system';
}

function onSystemAppearanceChange(): void {
    if (
        getCurrentAppearanceMode() === 'system' &&
        usesNativeMediaPlayer.value
    ) {
        scheduleNativePlayerSync();
    }
}

function clampFontScale(value: number): number {
    return Number(
        Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, value)).toFixed(2),
    );
}

function debounceNativePlayerSync(): void {
    if (nativePlayerSyncTimer) {
        clearTimeout(nativePlayerSyncTimer);
    }

    nativePlayerSyncTimer = setTimeout(() => {
        nativePlayerSyncTimer = null;
        void syncNativePlayer();
    }, 120);
}

async function loadFontScalePreference(): Promise<void> {
    try {
        const payload = await apiFetch<{ scale: number }>(FONT_SCALE_ENDPOINT);

        if (payload?.scale !== undefined && !Number.isNaN(payload.scale)) {
            fontScale.value = clampFontScale(payload.scale);
        }
    } catch {
        // Ignore failures and keep the default scale.
    }
}

async function persistFontScale(scale: number): Promise<void> {
    isSavingFontScale.value = true;

    try {
        await apiFetch<{ scale: number }>(FONT_SCALE_ENDPOINT, {
            method: 'POST',
            body: JSON.stringify({ scale }),
        });
    } catch (error) {
        console.warn('Failed to save font preference', error);
    } finally {
        isSavingFontScale.value = false;
    }
}

function adjustFontScale(delta: number): void {
    const nextScale = clampFontScale(fontScale.value + delta);

    if (Math.abs(nextScale - fontScale.value) < Number.EPSILON) {
        return;
    }

    fontScale.value = nextScale;
    void persistFontScale(nextScale);
}

async function handleOpenInAppBrowser(): Promise<void> {
    if (!props.inAppUrl || isOpeningInAppBrowser.value) {
        return;
    }

    isOpeningInAppBrowser.value = true;

    try {
        const opened = await openUrlInNativeBrowser(props.inAppUrl);

        if (!opened) {
            Browser.inApp(props.inAppUrl);
        }
    } finally {
        isOpeningInAppBrowser.value = false;
    }
}

function buildDownloadFilename(): string {
    if (props.downloadFileName) {
        return props.downloadFileName;
    }

    const title = props.activeNodeText.trim();
    const extension =
        props.downloadFileExtension ?? (props.isPdf ? 'pdf' : 'bin');

    if (title === '') {
        return `material.${extension}`;
    }

    const normalized = title.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ');

    if (normalized.toLowerCase().endsWith(`.${extension}`)) {
        return normalized;
    }

    return `${normalized}.${extension}`;
}

function openDownloadFallback(): void {
    const url = props.downloadProxyUrl ?? props.downloadUrl;

    if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

async function handleDownloadFile(): Promise<void> {
    if (!props.downloadUrl || isDownloadingFile.value) {
        return;
    }

    isDownloadingFile.value = true;
    downloadError.value = null;

    try {
        if (!isNativeAttachmentBridgeAvailable()) {
            openDownloadFallback();

            return;
        }

        const queuedTask = await queueAttachmentDownloadTask({
            cid: props.selectedCid,
            sourceUrl: props.downloadUrl,
            filename: buildDownloadFilename(),
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
                openDownloadFallback();
            }

            return;
        }

        if (completedTask.status === 'failed') {
            downloadError.value =
                completedTask.errorMessage ?? '下載失敗，請稍後再試。';
        }
    } catch (error) {
        downloadError.value =
            error instanceof Error ? error.message : '下載失敗，請稍後再試。';
    } finally {
        isDownloadingFile.value = false;
    }
}

const mediaEl = ref<HTMLMediaElement | null>(null);
let timeUpdateTimer: ReturnType<typeof setTimeout> | null = null;

function getNativePlayerType(): NativeMediaType {
    return props.isAudioCourse ? 'audio' : 'video';
}

function buildNativePlayerFrame(): {
    x: number;
    y: number;
    width: number;
    height: number;
} | null {
    const host = nativePlayerHost.value;

    if (!host) {
        return null;
    }

    const rect = host.getBoundingClientRect();
    const insetTopString = getComputedStyle(
        document.documentElement,
    ).getPropertyValue('--inset-top');
    const insetTop = Number.parseFloat(insetTopString) || 0;
    const isIosDevice = document.body.classList.contains('device-ios');

    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const y = Math.max(
        0,
        Math.round(isIosDevice ? rect.top - insetTop : rect.top),
    );

    return {
        x: Math.round(rect.left),
        y,
        width,
        height,
    };
}

async function syncNativePlayer(): Promise<void> {
    if (!usesNativeMediaPlayer.value || !props.videoUrl) {
        return;
    }

    const frame = buildNativePlayerFrame();

    if (!frame) {
        return;
    }

    const ok = await setNativeMediaPlayer({
        url: props.videoUrl,
        type: getNativePlayerType(),
        frame,
        courseName: props.courseTitle,
        materialName: props.activeNodeText,
        appearance: getCurrentAppearanceMode(),
        sessionContext: props.nativeSessionContext,
    });

    nativePlayerError.value = ok
        ? null
        : '無法初始化原生播放器，已改用網頁播放器。';

    if (!ok) {
        usesNativeMediaPlayer.value = false;
        nextTick(() => setupPlayer());
    }
}

function scheduleNativePlayerSync(): void {
    debounceNativePlayerSync();
}

function updateNowPlayingInfo() {
    const el = mediaEl.value;

    if (!el) {
        return;
    }
}

function setupPlayer() {
    const el = mediaEl.value;

    if (!el || !props.videoUrl) {
        return;
    }

    el.src = props.videoUrl;

    el.addEventListener('loadedmetadata', updateNowPlayingInfo);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ratechange', onRateChange);
}

function onTimeUpdate() {
    if (timeUpdateTimer) {
        return;
    }

    timeUpdateTimer = setTimeout(() => {
        timeUpdateTimer = null;
        const el = mediaEl.value;

        if (el) {
            emit('nowPlayingUpdate', el.currentTime, el.playbackRate);
        }
    }, 1000);
}

function onRateChange() {
    const el = mediaEl.value;

    if (el) {
        emit('nowPlayingUpdate', el.currentTime, el.playbackRate);
    }
}

function destroyPlayer() {
    const el = mediaEl.value;

    if (el) {
        el.removeEventListener('loadedmetadata', updateNowPlayingInfo);
        el.removeEventListener('timeupdate', onTimeUpdate);
        el.removeEventListener('ratechange', onRateChange);
    }

    if (timeUpdateTimer) {
        clearTimeout(timeUpdateTimer);
        timeUpdateTimer = null;
    }
}

function handleContentClick(event: MouseEvent) {
    const link = (event.target as HTMLElement)?.closest('a[href]');

    if (!link) {
        return;
    }

    const rawHref = link.getAttribute('href');

    if (!rawHref || rawHref.startsWith('#')) {
        return;
    }

    let resolvedHref: string;

    try {
        resolvedHref = new URL(rawHref, window.location.href).href;
    } catch {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    emit('contentLinkClick', resolvedHref);
}

watch(
    () => props.videoUrl,
    async (nextUrl) => {
        if (usesNativeMediaPlayer.value) {
            await stopNativeMediaPlayer();

            if (nextUrl) {
                nextTick(() => {
                    scheduleNativePlayerSync();
                });
            }

            return;
        }

        destroyPlayer();
        nextTick(() => setupPlayer());
    },
);

watch(
    () => props.isAudioCourse,
    () => {
        if (usesNativeMediaPlayer.value && props.videoUrl) {
            nextTick(() => {
                scheduleNativePlayerSync();
            });
        }
    },
);

watch(
    () => props.nativeSessionContext,
    () => {
        if (usesNativeMediaPlayer.value && props.videoUrl) {
            nextTick(() => {
                scheduleNativePlayerSync();
            });
        }
    },
    { deep: true },
);

watch(
    () => props.preferWebPlayer,
    async (preferWebPlayer) => {
        if (preferWebPlayer) {
            if (usesNativeMediaPlayer.value) {
                await stopNativeMediaPlayer();
                usesNativeMediaPlayer.value = false;
                nativePlayerError.value = null;
                nextTick(() => setupPlayer());
            }

            return;
        }

        if (!isNativeMediaBridgeAvailable() || usesNativeMediaPlayer.value) {
            return;
        }

        destroyPlayer();
        usesNativeMediaPlayer.value = true;

        nextTick(() => {
            scheduleNativePlayerSync();
        });
    },
);

onMounted(() => {
    window.addEventListener('resize', scheduleNativePlayerSync);
    systemAppearanceChangeMediaQuery = window.matchMedia(
        '(prefers-color-scheme: dark)',
    );
    systemAppearanceChangeMediaQuery.addEventListener(
        'change',
        onSystemAppearanceChange,
    );

    usesNativeMediaPlayer.value =
        isNativeMediaBridgeAvailable() && !props.preferWebPlayer;

    if (usesNativeMediaPlayer.value) {
        nextTick(() => {
            scheduleNativePlayerSync();
        });
    } else {
        nextTick(() => setupPlayer());
    }

    void loadFontScalePreference();
});

onUnmounted(() => {
    if (nativePlayerSyncTimer) {
        clearTimeout(nativePlayerSyncTimer);
        nativePlayerSyncTimer = null;
    }

    window.removeEventListener('resize', scheduleNativePlayerSync);
    systemAppearanceChangeMediaQuery?.removeEventListener(
        'change',
        onSystemAppearanceChange,
    );
    systemAppearanceChangeMediaQuery = null;

    if (usesNativeMediaPlayer.value) {
        void stopNativeMediaPlayer();

        return;
    }

    destroyPlayer();
});

async function getCurrentTime(): Promise<number> {
    if (usesNativeMediaPlayer.value) {
        return getNativeMediaCurrentTime();
    }

    const el = mediaEl.value;

    return el ? el.currentTime : 0;
}

async function seekTo(seconds: number): Promise<void> {
    if (usesNativeMediaPlayer.value) {
        try {
            const { BridgeCall } = await import('#nativephp');
            await BridgeCall('MediaPlayer.Seek', { time: seconds });
        } catch {
            // ignore; best effort
        }

        return;
    }

    const el = mediaEl.value;

    if (!el) {
        return;
    }

    const performSeek = () => {
        try {
            el.currentTime = seconds;
            void el.play();
        } catch {
            // ignore invalid seek in early loading state
        }
    };

    if (el.readyState >= 1) {
        performSeek();

        return;
    }

    const listener = () => {
        performSeek();
        el.removeEventListener('loadedmetadata', listener);
    };

    el.addEventListener('loadedmetadata', listener, { once: true });
}

async function closePlayer(): Promise<void> {
    if (usesNativeMediaPlayer.value) {
        await stopNativeMediaPlayer();
    }

    const el = mediaEl.value;

    if (el) {
        el.pause();
        el.currentTime = 0;
        el.removeAttribute('src');
        destroyPlayer();
    }
}

defineExpose({ getCurrentTime, seekTo, closePlayer });
</script>

<template>
    <section class="space-y-4">
        <div
            v-if="videoUrl"
            class="sticky top-[calc(var(--inset-top,0px)+4.75rem)] md:static"
        >
            <div
                v-if="usesNativeMediaPlayer"
                ref="nativePlayerHost"
                class="overflow-hidden rounded-2xl opacity-0"
                :class="isAudioCourse ? 'h-32' : 'aspect-video'"
            >
                <span>正在使用原生播放器</span>
            </div>

            <div
                v-else
                class="overflow-hidden rounded-2xl border border-warm-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
            >
                <audio
                    v-if="isAudioCourse"
                    ref="mediaEl"
                    controls
                    class="w-full"
                    :title="activeNodeText"
                    preload="metadata"
                />
                <video
                    v-else
                    ref="mediaEl"
                    controls
                    playsinline
                    webkit-playsinline="true"
                    x5-playsinline="true"
                    class="aspect-video w-full bg-black"
                    :title="activeNodeText"
                    preload="metadata"
                >
                    <track
                        v-if="subtitleUrl"
                        kind="subtitles"
                        :src="subtitleUrl"
                        label="字幕"
                        default
                    />
                </video>
            </div>

            <p
                v-if="nativePlayerError"
                class="border-t border-warm-700/30 bg-warm-900/90 px-3 py-2 text-xs text-warm-100"
            >
                {{ nativePlayerError }}
            </p>
        </div>

        <div
            v-if="props.inAppUrl || hasHtmlContent || hasDownloadableContent"
            class="space-y-3"
        >
            <div
                class="flex flex-row items-stretch justify-between gap-2 rounded-2xl border border-warm-200 bg-white/90 px-4 py-3 text-xs font-medium text-warm-700 shadow-sm sm:px-6 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
                <button
                    type="button"
                    class="h-10 w-full truncate rounded-lg border border-warm-200 bg-white px-3 text-sm font-medium text-warm-900 transition hover:border-warm-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-400"
                    :disabled="!props.inAppUrl || isOpeningInAppBrowser"
                    @click="handleOpenInAppBrowser"
                >
                    使用內建瀏覽器開啟
                </button>

                <button
                    v-if="hasDownloadableContent"
                    type="button"
                    class="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-warm-200 bg-white px-3 text-sm font-semibold transition hover:border-warm-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-400"
                    :disabled="!props.downloadUrl || isDownloadingFile"
                    @click="handleDownloadFile"
                >
                    <svg
                        v-if="isDownloadingFile"
                        class="h-4 w-4 motion-safe:animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                    >
                        <circle
                            cx="12"
                            cy="12"
                            r="9"
                            stroke="currentColor"
                            stroke-width="3"
                            class="opacity-30"
                        />
                        <path
                            d="M21 12a9 9 0 0 0-9-9"
                            stroke="currentColor"
                            stroke-width="3"
                            stroke-linecap="round"
                        />
                    </svg>
                    <span>{{
                        isDownloadingFile
                            ? '下載中...'
                            : props.isPdf
                              ? '下載 PDF'
                              : '下載檔案'
                    }}</span>
                </button>

                <div
                    v-else-if="hasHtmlContent"
                    class="inline-flex h-10 items-center gap-2 rounded-xl border border-warm-200 bg-warm-50 px-2 text-warm-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                    <button
                        type="button"
                        class="flex h-8 w-8 items-center justify-center rounded-lg border border-warm-200 bg-white text-sm font-semibold transition hover:border-warm-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-400"
                        :disabled="!canZoomOut || isSavingFontScale"
                        @click="adjustFontScale(-FONT_SCALE_STEP)"
                        aria-label="縮小字體"
                    >
                        A-
                    </button>
                    <button
                        class="w-12 text-center text-sm font-semibold text-warm-900 tabular-nums dark:text-zinc-100"
                        @click="adjustFontScale(FONT_SCALE_DEFAULT - fontScale)"
                    >
                        {{ scaleLabel }}
                    </button>
                    <button
                        type="button"
                        class="flex h-8 w-8 items-center justify-center rounded-lg border border-warm-200 bg-white text-sm font-semibold transition hover:border-warm-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-400"
                        :disabled="!canZoomIn || isSavingFontScale"
                        @click="adjustFontScale(FONT_SCALE_STEP)"
                        aria-label="放大字體"
                    >
                        A+
                    </button>
                </div>
            </div>

            <article
                v-if="hasHtmlContent && !hasDownloadableContent"
                class="prose prose-sm max-w-none rounded-2xl border border-warm-200 bg-white px-4 py-5 text-warm-800 shadow-sm prose-warm sm:px-6 md:prose-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:prose-zinc dark:prose-invert"
                :style="fontScaleStyle"
                @click="handleContentClick"
                v-html="processedHtmlContent"
            />

            <div
                v-else-if="hasDownloadableContent"
                class="rounded-2xl border border-warm-200 bg-white p-5 text-sm text-warm-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
                <p class="mb-3">
                    <template v-if="props.isPdf">
                        本教材為 PDF 檔案，您可以下載後以其他 App
                        開啟或使用內建瀏覽器檢視。
                    </template>
                    <template v-else>
                        本教材為可下載檔案（{{
                            props.downloadFileExtension
                                ? `.${props.downloadFileExtension}`
                                : ''
                        }}），請下載後以其他 App 開啟。
                    </template>
                </p>
                <p v-if="downloadError" class="text-red-600 dark:text-red-400">
                    {{ downloadError }}
                </p>
            </div>
        </div>

        <p
            v-if="!videoUrl && !hasHtmlContent && !hasDownloadableContent"
            class="rounded-xl border border-dashed border-warm-300 bg-warm-50 p-4 text-sm text-warm-700"
        >
            此節點沒有可顯示的教材內容。
        </p>

        <div
            v-if="resources.length > 1"
            class="rounded-2xl border border-warm-200 bg-white/90 p-4"
        >
            <h3 class="mb-2 text-sm font-semibold text-warm-900">附件資源</h3>
            <ul class="space-y-2 text-sm">
                <li
                    v-for="(resource, index) in resources"
                    :key="index"
                    class="rounded-lg border border-warm-200 bg-warm-50 px-3 py-2 text-warm-800"
                >
                    {{
                        resource.filename ||
                        resource.title ||
                        resource.href ||
                        `資源 ${index + 1}`
                    }}
                </li>
            </ul>
        </div>
    </section>
</template>
