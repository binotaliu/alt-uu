<script setup lang="ts">
import {
    ArrowDownTrayIcon,
    ArrowPathIcon,
    ClipboardDocumentIcon,
    TrashIcon,
} from '@heroicons/vue/24/outline';
import { onMounted, ref } from 'vue';
import AndroidBottomControlBackground from '@/components/AndroidBottomControlBackground.vue';
import AppLayout from '@/components/AppLayout.vue';
import BackButton from '@/components/BackButton.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import DiagnosticEventRow from '@/components/DiagnosticEventRow.vue';
import { useDiagnosticLog, BUNDLE_URL } from '@/composables/useDiagnosticLog';
import { useDiagnosticRecording } from '@/composables/useDiagnosticRecording';
import { useTitle } from '@/composables/useTitle';
import { copyToClipboard } from '@/lib/clipboard';
import {
    downloadAttachmentWithNativeBridge,
    isNativeAttachmentBridgeAvailable,
} from '@/lib/nativeAttachment';

useTitle('診斷記錄');

const {
    events,
    total,
    isLoading,
    error,
    problemsOnly,
    load,
    toggleProblemsOnly,
    clear,
    prepareBundle,
} = useDiagnosticLog();

const {
    status: recordingStatus,
    isRecording,
    minutesRemaining,
    isBusy: isSavingRecording,
    error: recordingError,
    load: loadRecordingStatus,
    setRecording,
} = useDiagnosticRecording();

const isSharing = ref(false);
const isCopying = ref(false);
const actionError = ref<string | null>(null);
const confirmClearOpen = ref(false);

function bundleFilename(): string {
    return `alt-uu-diagnostics-${new Date().toISOString().slice(0, 10)}.md`;
}

/**
 * Mirrors the data-export flow: the bridge fetches through the embedded
 * Laravel runtime and hands the file to the platform save/share sheet, so
 * this needs no native code of its own.
 */
async function onShare(): Promise<void> {
    if (isSharing.value) {
        return;
    }

    isSharing.value = true;
    actionError.value = null;

    try {
        await prepareBundle();

        if (isNativeAttachmentBridgeAvailable()) {
            const ok = await downloadAttachmentWithNativeBridge(
                BUNDLE_URL,
                bundleFilename(),
            );

            if (!ok) {
                throw new Error('匯出失敗，請稍後再試。');
            }
        } else {
            const link = document.createElement('a');
            link.href = BUNDLE_URL;
            link.download = bundleFilename();
            document.body.appendChild(link);
            link.click();
            link.remove();
        }

        window.showFlashMessage('已匯出診斷記錄', 'success');
    } catch (e) {
        actionError.value =
            e instanceof Error ? e.message : '匯出失敗，請稍後再試。';
    } finally {
        isSharing.value = false;
    }
}

async function onCopy(): Promise<void> {
    if (isCopying.value) {
        return;
    }

    isCopying.value = true;
    actionError.value = null;

    try {
        await prepareBundle();

        const response = await fetch(BUNDLE_URL, {
            headers: { Accept: 'text/markdown' },
        });

        if (!response.ok) {
            throw new Error('複製失敗，請稍後再試。');
        }

        const copied = await copyToClipboard(await response.text());

        window.showFlashMessage(
            copied ? '已複製診斷記錄' : '複製失敗，請改用分享',
            copied ? 'success' : 'error',
        );
    } catch (e) {
        actionError.value =
            e instanceof Error ? e.message : '複製失敗，請稍後再試。';
    } finally {
        isCopying.value = false;
    }
}

async function onConfirmClear(): Promise<void> {
    confirmClearOpen.value = false;
    actionError.value = null;

    try {
        await clear();
        window.showFlashMessage('已清除診斷記錄', 'success');
    } catch (e) {
        actionError.value =
            e instanceof Error ? e.message : '清除失敗，請稍後再試。';
    }
}

async function onToggleRecording(enabled: boolean): Promise<void> {
    await setRecording(enabled);
    // A freshly opened window flushes the in-memory client buffer, so the
    // failure the user just hit is captured rather than lost.
    await load();
}

onMounted(() => {
    void loadRecordingStatus();
    void load();
});
</script>

<template>
    <AppLayout>
        <div
            class="sticky top-0 z-200 w-full bg-theme-100 py-1.5 pt-(--inset-top,4rem) pr-(--inset-right,0px) pl-[max(var(--inset-left,0px),var(--corner-inset-left,0px),1rem)] dark:bg-zinc-950"
        >
            <div
                class="flex items-center justify-between gap-2 pt-0.5 text-theme-900 dark:text-zinc-100"
            >
                <div class="flex items-center gap-2">
                    <BackButton href="/settings" />

                    <h2 class="text-lg font-semibold">診斷記錄</h2>
                </div>
            </div>
        </div>

        <div class="mx-auto mt-6 w-full max-w-4xl space-y-4 px-4 pb-24">
            <section
                v-if="recordingStatus?.available !== false"
                :class="[
                    'rounded-xl border p-4 shadow-sm',
                    isRecording
                        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950'
                        : 'border-theme-200 bg-white dark:border-zinc-700 dark:bg-zinc-900',
                ]"
            >
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <h3
                            class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                        >
                            {{ isRecording ? '記錄中' : '診斷記錄未開啟' }}
                        </h3>
                        <p
                            class="mt-1 text-xs leading-relaxed text-theme-700 dark:text-zinc-400"
                        >
                            <template v-if="isRecording">
                                約
                                {{ minutesRemaining }}
                                分鐘後自動關閉。請重現一次問題，再回到這裡分享記錄。
                            </template>
                            <template v-else>
                                為了節省效能與空間，平常不會記錄。開啟後會記錄
                                {{ recordingStatus?.windowMinutes ?? 30 }}
                                分鐘，接著自動關閉。
                            </template>
                        </p>
                        <p
                            v-if="recordingError"
                            class="mt-1 text-xs text-rose-600 dark:text-rose-400"
                        >
                            {{ recordingError }}
                        </p>
                    </div>

                    <button
                        type="button"
                        class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition"
                        :class="
                            isRecording
                                ? 'bg-emerald-600 dark:bg-emerald-500'
                                : 'bg-theme-300 dark:bg-zinc-600'
                        "
                        :disabled="isSavingRecording"
                        @click="onToggleRecording(!isRecording)"
                    >
                        <span class="sr-only">切換診斷記錄</span>
                        <span
                            class="inline-block size-5 transform rounded-full bg-white shadow transition"
                            :class="
                                isRecording ? 'translate-x-6' : 'translate-x-1'
                            "
                        />
                    </button>
                </div>
            </section>

            <section
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <p class="text-xs text-theme-700 dark:text-zinc-400">
                    這裡記錄了 App
                    最近的請求與錯誤。回報問題時，請一併附上這份記錄，
                    可以大幅加快找出問題的速度。
                </p>
                <p class="mt-2 text-xs text-theme-700 dark:text-zinc-400">
                    記錄中的帳號資訊已以代號取代，密碼、Cookie
                    與登入憑證則完全不會被記錄。
                </p>

                <div class="mt-3 grid gap-2 sm:grid-cols-3">
                    <button
                        type="button"
                        class="inline-flex items-center justify-center gap-2 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm font-medium text-theme-800 hover:border-theme-400 hover:bg-theme-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                        :disabled="isSharing"
                        @click="onShare"
                    >
                        <ArrowDownTrayIcon class="size-4" />
                        <span>{{ isSharing ? '匯出中…' : '分享' }}</span>
                    </button>
                    <button
                        type="button"
                        class="inline-flex items-center justify-center gap-2 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm font-medium text-theme-800 hover:border-theme-400 hover:bg-theme-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                        :disabled="isCopying"
                        @click="onCopy"
                    >
                        <ClipboardDocumentIcon class="size-4" />
                        <span>{{ isCopying ? '複製中…' : '複製' }}</span>
                    </button>
                    <button
                        type="button"
                        class="inline-flex items-center justify-center gap-2 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm font-medium text-theme-800 hover:border-theme-400 hover:bg-theme-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                        @click="confirmClearOpen = true"
                    >
                        <TrashIcon class="size-4" />
                        <span>清除</span>
                    </button>
                </div>

                <p
                    v-if="actionError"
                    class="mt-2 text-xs text-rose-600 dark:text-rose-400"
                >
                    {{ actionError }}
                </p>
            </section>

            <section
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <button
                            type="button"
                            :class="[
                                'rounded-lg px-2.5 py-1.5 text-xs font-medium',
                                !problemsOnly
                                    ? 'bg-theme-200 text-theme-900 dark:bg-zinc-700 dark:text-zinc-100'
                                    : 'text-theme-700 dark:text-zinc-400',
                            ]"
                            @click="toggleProblemsOnly(false)"
                        >
                            全部
                        </button>
                        <button
                            type="button"
                            :class="[
                                'rounded-lg px-2.5 py-1.5 text-xs font-medium',
                                problemsOnly
                                    ? 'bg-theme-200 text-theme-900 dark:bg-zinc-700 dark:text-zinc-100'
                                    : 'text-theme-700 dark:text-zinc-400',
                            ]"
                            @click="toggleProblemsOnly(true)"
                        >
                            僅錯誤
                        </button>
                    </div>

                    <button
                        type="button"
                        class="inline-flex items-center gap-1.5 text-xs text-theme-700 hover:text-theme-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                        :disabled="isLoading"
                        @click="load"
                    >
                        <ArrowPathIcon
                            class="size-4"
                            :class="{ 'animate-spin': isLoading }"
                        />
                        <span>重新整理</span>
                    </button>
                </div>

                <p
                    v-if="error"
                    class="mt-3 text-xs text-rose-600 dark:text-rose-400"
                >
                    {{ error }}
                </p>

                <p
                    v-else-if="!isLoading && events.length === 0"
                    class="mt-3 text-xs text-theme-700 dark:text-zinc-400"
                >
                    {{
                        isRecording
                            ? '目前沒有任何記錄，請重現一次問題。'
                            : '目前沒有任何記錄。請先於上方開啟診斷記錄，再重現一次問題。'
                    }}
                </p>

                <ul v-else class="mt-2">
                    <DiagnosticEventRow
                        v-for="event in events"
                        :key="event.id"
                        :event="event"
                    />
                </ul>

                <p
                    v-if="events.length > 0"
                    class="mt-3 text-xs text-theme-700 dark:text-zinc-400"
                >
                    顯示 {{ events.length }} 筆，共 {{ total }} 筆。
                </p>
            </section>
        </div>

        <AndroidBottomControlBackground />

        <ConfirmDialog
            :is-open="confirmClearOpen"
            danger
            title="清除診斷記錄"
            message="清除後將無法復原，且先前的錯誤記錄將不再能用於回報問題。"
            confirm-label="清除"
            @confirm="onConfirmClear"
            @cancel="confirmClearOpen = false"
        />
    </AppLayout>
</template>
