<script setup lang="ts">
import {
    AcademicCapIcon,
    EnvelopeIcon,
    DocumentMagnifyingGlassIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
    SignalIcon,
    SparklesIcon,
    CodeBracketIcon,
    TrashIcon,
} from '@heroicons/vue/24/outline';
import { ref, onMounted } from 'vue';
import { Browser } from '#nativephp';
import AndroidBottomControlBackground from '@/components/AndroidBottomControlBackground.vue';
import AppLayout from '@/components/AppLayout.vue';
import BackButton from '@/components/BackButton.vue';
import ThemeSettings from '@/components/ThemeSettings.vue';
import { useDiagnosticRecording } from '@/composables/useDiagnosticRecording';
import { useTitle } from '@/composables/useTitle';
import { useWhatsNew } from '@/composables/useWhatsNew';
import { clearDownloadedAttachments } from '@/lib/nativeAttachment';
import { useAppConfigStore } from '@/stores/appConfig';

useTitle('設定');

const configStore = useAppConfigStore();
const { open: openWhatsNew } = useWhatsNew();

const nouToolsIntegrationEnabled = ref<boolean>(false);
const isSavingNouToolsIntegration = ref(false);
const screenReaderEnhancedSupportEnabled = ref<boolean>(false);
const isSavingScreenReaderEnhancedSupport = ref(false);
const altUuPlusDisabled = ref<boolean>(false);
const isSavingAltUuPlusDisabled = ref(false);
const liveSessionNicknameModalEnabled = ref<boolean>(true);
const isSavingLiveSessionNicknameModal = ref(false);
const cellularPlaybackWarningEnabled = ref<boolean>(true);
const isSavingCellularPlaybackWarning = ref(false);
const isClearingDownloadedAttachments = ref(false);
const attachmentCleanupSummary = ref<string | null>(null);
const attachmentCleanupError = ref<string | null>(null);

const {
    status: recordingStatus,
    isRecording,
    minutesRemaining,
    isBusy: isSavingRecording,
    error: recordingError,
    load: loadRecordingStatus,
    setRecording,
} = useDiagnosticRecording();

onMounted(async () => {
    void configStore.loadConfig();
    void loadRecordingStatus();
    await configStore.loadPreferences();

    nouToolsIntegrationEnabled.value = configStore.nouToolsIntegrationEnabled;
    screenReaderEnhancedSupportEnabled.value =
        configStore.screenReaderEnhancedSupportEnabled;
    altUuPlusDisabled.value = configStore.altUuPlusDisabled;
    liveSessionNicknameModalEnabled.value =
        configStore.liveSessionNicknameModalEnabled;
    cellularPlaybackWarningEnabled.value =
        configStore.cellularPlaybackWarningEnabled;
});

async function setNouToolsIntegrationEnabled(enabled: boolean) {
    nouToolsIntegrationEnabled.value = enabled;
    isSavingNouToolsIntegration.value = true;

    try {
        await configStore.updatePreferences({
            nouToolsIntegrationEnabled: enabled,
        });
    } finally {
        isSavingNouToolsIntegration.value = false;
    }
}

async function setScreenReaderEnhancedSupportEnabled(enabled: boolean) {
    screenReaderEnhancedSupportEnabled.value = enabled;
    isSavingScreenReaderEnhancedSupport.value = true;

    try {
        await configStore.updatePreferences({
            screenReaderEnhancedSupportEnabled: enabled,
        });
    } finally {
        isSavingScreenReaderEnhancedSupport.value = false;
    }
}

async function setAltUuPlusDisabled(disabled: boolean) {
    altUuPlusDisabled.value = disabled;
    isSavingAltUuPlusDisabled.value = true;

    try {
        await configStore.updatePreferences({ altUuPlusDisabled: disabled });
    } finally {
        isSavingAltUuPlusDisabled.value = false;
    }
}

async function setLiveSessionNicknameModalEnabled(enabled: boolean) {
    liveSessionNicknameModalEnabled.value = enabled;
    isSavingLiveSessionNicknameModal.value = true;

    try {
        await configStore.updatePreferences({
            liveSessionNicknameModalEnabled: enabled,
        });
    } finally {
        isSavingLiveSessionNicknameModal.value = false;
    }
}

async function setCellularPlaybackWarningEnabled(enabled: boolean) {
    cellularPlaybackWarningEnabled.value = enabled;
    isSavingCellularPlaybackWarning.value = true;

    try {
        await configStore.updatePreferences({
            cellularPlaybackWarningEnabled: enabled,
        });
    } finally {
        isSavingCellularPlaybackWarning.value = false;
    }
}

async function openInApp(url: string) {
    try {
        const handled = await Browser.inApp(url);

        if (!handled) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    } catch {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

async function clearAttachmentDownloads() {
    if (isClearingDownloadedAttachments.value) {
        return;
    }

    const confirmed = window.confirm(
        '這會清除目前裝置中 Alt UU 已下載的所有附件檔案。確定要繼續嗎？',
    );

    if (!confirmed) {
        return;
    }

    isClearingDownloadedAttachments.value = true;
    attachmentCleanupSummary.value = null;
    attachmentCleanupError.value = null;

    try {
        const result = await clearDownloadedAttachments();

        attachmentCleanupSummary.value = `已清除 ${result.deletedFiles} 個檔案（共更新 ${result.clearedTasks} 筆下載紀錄）。`;
    } catch (error) {
        attachmentCleanupError.value =
            error instanceof Error
                ? error.message
                : '清除附件失敗，請稍後再試。';
    } finally {
        isClearingDownloadedAttachments.value = false;
    }
}
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
                    <BackButton
                        :href="configStore.isLoggedIn ? '/courses' : '/login'"
                    />

                    <h2 class="text-lg font-semibold">設定</h2>
                </div>
            </div>
        </div>

        <div class="mx-auto mt-6 w-full max-w-4xl space-y-4 px-4 pb-24">
            <div
                class="mb-8 flex w-full flex-col items-center justify-center gap-4 py-2"
            >
                <div class="flex flex-col items-center md:flex-row md:gap-4">
                    <AcademicCapIcon class="size-16 text-theme-700" />
                    <span class="text-2xl font-extrabold text-theme-700"
                        >Alt UU</span
                    >
                </div>
                <span class="font-semibold text-theme-700">
                    {{ configStore.appDisplayVersion }} ({{
                        configStore.appVersionCode
                    }})
                </span>
            </div>

            <ThemeSettings />

            <section
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <h3
                            class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                        >
                            開啟 NOU 小幫手整合
                        </h3>
                        <p
                            class="mt-1 text-xs leading-relaxed text-theme-700 dark:text-zinc-400"
                        >
                            開啟此選項以讓 Alt UU 從 NOU
                            小幫手取得課程資訊與視訊面授資訊。部分詮釋資料可能會傳送給
                            NOU 小幫手以提供此功能。
                        </p>
                    </div>

                    <button
                        type="button"
                        class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition"
                        :class="
                            nouToolsIntegrationEnabled
                                ? 'bg-theme-700 dark:bg-theme-600'
                                : 'bg-theme-300 dark:bg-zinc-600'
                        "
                        :disabled="isSavingNouToolsIntegration"
                        @click="
                            setNouToolsIntegrationEnabled(
                                !nouToolsIntegrationEnabled,
                            )
                        "
                    >
                        <span class="sr-only">切換 NOU 小幫手整合</span>
                        <span
                            class="inline-block size-5 transform rounded-full bg-white shadow transition"
                            :class="
                                nouToolsIntegrationEnabled
                                    ? 'translate-x-6'
                                    : 'translate-x-1'
                            "
                        />
                    </button>
                </div>
            </section>

            <section
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <h3
                            class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                        >
                            加強螢幕閱讀器支援
                        </h3>
                        <p
                            class="mt-1 text-xs leading-relaxed text-theme-700 dark:text-zinc-400"
                        >
                            若您使用螢幕閱讀器，如 VoiceOver、TalkBack、NVDA 或
                            JAWS，開啟此選項可讓 Alt UU
                            在教材頁中使用對螢幕閱讀器較友善的播放器。
                        </p>
                    </div>

                    <button
                        type="button"
                        class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition"
                        :class="
                            screenReaderEnhancedSupportEnabled
                                ? 'bg-theme-700 dark:bg-theme-600'
                                : 'bg-theme-300 dark:bg-zinc-600'
                        "
                        :disabled="isSavingScreenReaderEnhancedSupport"
                        @click="
                            setScreenReaderEnhancedSupportEnabled(
                                !screenReaderEnhancedSupportEnabled,
                            )
                        "
                    >
                        <span class="sr-only">切換增強螢幕閱讀器支援</span>
                        <span
                            class="inline-block size-5 transform rounded-full bg-white shadow transition"
                            :class="
                                screenReaderEnhancedSupportEnabled
                                    ? 'translate-x-6'
                                    : 'translate-x-1'
                            "
                        />
                    </button>
                </div>
            </section>

            <section
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <h3
                            class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                        >
                            視訊面授前顯示暱稱設定提示
                        </h3>
                        <p
                            class="mt-1 text-xs leading-relaxed text-theme-700 dark:text-zinc-400"
                        >
                            開啟此選項後，點擊「進入教室」或「備用教室」時會先顯示提示視窗，告訴您應設定的顯示暱稱並提供複製功能，再進入教室。
                        </p>
                    </div>

                    <button
                        type="button"
                        class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition"
                        :class="
                            liveSessionNicknameModalEnabled
                                ? 'bg-theme-700 dark:bg-theme-600'
                                : 'bg-theme-300 dark:bg-zinc-600'
                        "
                        :disabled="isSavingLiveSessionNicknameModal"
                        @click="
                            setLiveSessionNicknameModalEnabled(
                                !liveSessionNicknameModalEnabled,
                            )
                        "
                    >
                        <span class="sr-only"
                            >切換視訊面授前顯示暱稱設定提示</span
                        >
                        <span
                            class="inline-block size-5 transform rounded-full bg-white shadow transition"
                            :class="
                                liveSessionNicknameModalEnabled
                                    ? 'translate-x-6'
                                    : 'translate-x-1'
                            "
                        />
                    </button>
                </div>
            </section>

            <section
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <h3
                            class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                        >
                            行動網路播放提醒
                        </h3>
                        <p
                            class="mt-1 text-xs leading-relaxed text-theme-700 dark:text-zinc-400"
                        >
                            開啟此選項後，透過行動網路（非
                            Wi-Fi）觀看教材影音前，會先詢問是否繼續播放，避免消耗過多行動數據。
                        </p>
                    </div>

                    <button
                        type="button"
                        class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition"
                        :class="
                            cellularPlaybackWarningEnabled
                                ? 'bg-theme-700 dark:bg-theme-600'
                                : 'bg-theme-300 dark:bg-zinc-600'
                        "
                        :disabled="isSavingCellularPlaybackWarning"
                        @click="
                            setCellularPlaybackWarningEnabled(
                                !cellularPlaybackWarningEnabled,
                            )
                        "
                    >
                        <span class="sr-only">切換行動網路播放提醒</span>
                        <span
                            class="inline-block size-5 transform rounded-full bg-white shadow transition"
                            :class="
                                cellularPlaybackWarningEnabled
                                    ? 'translate-x-6'
                                    : 'translate-x-1'
                            "
                        />
                    </button>
                </div>
            </section>

            <section
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <h3
                            class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                        >
                            關閉 Alt UU+ 功能
                        </h3>
                        <p
                            class="mt-1 text-xs leading-relaxed text-theme-700 dark:text-zinc-400"
                        >
                            在界面上隱藏 Alt UU+
                            專屬功能，包括主題色、學習統計與資料匯出入。請注意：若你已有
                            Alt UU+ 訂閱，開啟此選項並不會取消訂閱。
                        </p>
                    </div>

                    <button
                        type="button"
                        class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition"
                        :class="
                            altUuPlusDisabled
                                ? 'bg-theme-700 dark:bg-theme-600'
                                : 'bg-theme-300 dark:bg-zinc-600'
                        "
                        :disabled="isSavingAltUuPlusDisabled"
                        @click="setAltUuPlusDisabled(!altUuPlusDisabled)"
                    >
                        <span class="sr-only">切換關閉 Alt UU+ 功能</span>
                        <span
                            class="inline-block size-5 transform rounded-full bg-white shadow transition"
                            :class="
                                altUuPlusDisabled
                                    ? 'translate-x-6'
                                    : 'translate-x-1'
                            "
                        />
                    </button>
                </div>
            </section>

            <section
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <h3
                            class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                        >
                            附件下載
                        </h3>
                        <p
                            class="mt-1 text-xs leading-relaxed text-theme-700 dark:text-zinc-400"
                        >
                            清除先前下載到本機的附件檔案，釋放裝置儲存空間。
                        </p>
                    </div>

                    <button
                        type="button"
                        class="inline-flex shrink-0 items-center gap-2 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm font-medium text-theme-800 transition hover:border-theme-400 hover:bg-theme-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                        :disabled="isClearingDownloadedAttachments"
                        @click="clearAttachmentDownloads"
                    >
                        <TrashIcon class="size-4" />
                        <span>{{
                            isClearingDownloadedAttachments
                                ? '清除中...'
                                : '清除已下載附件'
                        }}</span>
                    </button>
                </div>

                <p
                    v-if="attachmentCleanupSummary"
                    class="mt-3 text-xs text-emerald-700 dark:text-emerald-300"
                >
                    {{ attachmentCleanupSummary }}
                </p>
                <p
                    v-if="attachmentCleanupError"
                    class="mt-3 text-xs text-rose-700 dark:text-rose-300"
                >
                    {{ attachmentCleanupError }}
                </p>
            </section>

            <section
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <div class="flex justify-between gap-2">
                    <div class="flex flex-col gap-1">
                        <h3
                            class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                        >
                            疑難排解
                        </h3>
                        <p class="text-xs text-theme-700 dark:text-zinc-400">
                            若您遇到連線問題，可以檢查各項服務目前是否可正常連線。
                        </p>
                    </div>
                    <router-link
                        :to="{ name: 'settings.diagnostics' }"
                        class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm font-medium text-theme-800 hover:border-theme-400 hover:bg-theme-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                    >
                        <SignalIcon
                            class="size-4 text-theme-700 dark:text-zinc-200"
                        />
                        <span>連線診斷</span>
                    </router-link>
                </div>

                <div
                    class="mt-4 flex justify-between gap-2 border-t border-theme-200 pt-4 dark:border-zinc-700"
                >
                    <div class="flex flex-col gap-1">
                        <h3
                            class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                        >
                            教材來源檢視
                        </h3>
                        <p class="text-xs text-theme-700 dark:text-zinc-400">
                            教材目錄或內容顯示不出來時，可以查看學校實際送來的目錄網址與頁面原始碼。
                        </p>
                    </div>
                    <router-link
                        :to="{ name: 'settings.material-source' }"
                        class="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm font-medium text-theme-800 hover:border-theme-400 hover:bg-theme-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                    >
                        <DocumentMagnifyingGlassIcon
                            class="size-4 text-theme-700 dark:text-zinc-200"
                        />
                        <span>檢視來源</span>
                    </router-link>
                </div>

                <div
                    v-if="recordingStatus?.available !== false"
                    class="mt-4 border-t border-theme-200 pt-4 dark:border-zinc-700"
                >
                    <div class="flex items-start justify-between gap-4">
                        <div>
                            <h3
                                class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                            >
                                紀錄診斷紀錄以協助瞭解問題
                            </h3>
                            <p
                                class="mt-1 text-xs leading-relaxed text-theme-700 dark:text-zinc-400"
                            >
                                開啟後會記錄 App
                                的請求與錯誤，方便回報問題時附上。為了節省效能與空間，會在
                                {{ recordingStatus?.windowMinutes ?? 30 }}
                                分鐘後自動關閉，記錄也會在
                                {{ recordingStatus?.retentionDays ?? 14 }}
                                天後自動清除。
                            </p>
                            <p
                                v-if="isRecording"
                                class="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                            >
                                記錄中，約
                                {{ minutesRemaining }} 分鐘後自動關閉。
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
                                    ? 'bg-theme-700 dark:bg-theme-600'
                                    : 'bg-theme-300 dark:bg-zinc-600'
                            "
                            :disabled="isSavingRecording"
                            @click="setRecording(!isRecording)"
                        >
                            <span class="sr-only">切換診斷記錄</span>
                            <span
                                class="inline-block size-5 transform rounded-full bg-white shadow transition"
                                :class="
                                    isRecording
                                        ? 'translate-x-6'
                                        : 'translate-x-1'
                                "
                            />
                        </button>
                    </div>

                    <router-link
                        :to="{ name: 'settings.diagnostics-log' }"
                        class="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm font-medium text-theme-800 hover:border-theme-400 hover:bg-theme-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                    >
                        <DocumentTextIcon
                            class="size-4 text-theme-700 dark:text-zinc-200"
                        />
                        <span>檢視診斷記錄</span>
                    </router-link>
                </div>
            </section>

            <section
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <h3
                    class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                >
                    聯絡資訊與政策
                </h3>
                <div class="mt-2 grid gap-2">
                    <a
                        class="inline-flex items-center justify-center gap-2 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm font-medium text-theme-800 hover:border-theme-400 hover:bg-theme-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                        href="mailto:alt-uu-contact@binota.org"
                    >
                        <EnvelopeIcon
                            class="size-4 text-theme-700 dark:text-zinc-200"
                        />
                        <span class="w-30 text-center"> 聯絡本 App 作者 </span>
                    </a>
                    <button
                        type="button"
                        class="inline-flex items-center justify-center gap-2 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm font-medium text-theme-800 hover:border-theme-400 hover:bg-theme-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                        @click="
                            openInApp(
                                'https://alt-uu-statics.wcsvdzeimhwq.workers.dev/usage-policy',
                            )
                        "
                    >
                        <DocumentTextIcon
                            class="size-4 text-theme-700 dark:text-zinc-200"
                        />
                        <span class="w-30 text-center"> 使用條款 </span>
                    </button>
                    <button
                        type="button"
                        class="inline-flex items-center justify-center gap-2 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm font-medium text-theme-800 hover:border-theme-400 hover:bg-theme-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                        @click="
                            openInApp(
                                'https://alt-uu-statics.wcsvdzeimhwq.workers.dev/privacy-policy',
                            )
                        "
                    >
                        <ShieldCheckIcon
                            class="size-4 text-theme-700 dark:text-zinc-200"
                        />
                        <span class="w-30 text-center"> 隱私權政策 </span>
                    </button>
                    <button
                        type="button"
                        class="inline-flex items-center justify-center gap-2 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm font-medium text-theme-800 hover:border-theme-400 hover:bg-theme-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                        @click="openWhatsNew"
                    >
                        <SparklesIcon
                            class="size-4 text-theme-700 dark:text-zinc-200"
                        />
                        <span class="w-30 text-center"> 檢視新功能 </span>
                    </button>
                    <button
                        type="button"
                        class="inline-flex items-center justify-center gap-2 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm font-medium text-theme-800 hover:border-theme-400 hover:bg-theme-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                        @click="
                            openInApp('https://github.com/binotaliu/alt-uu')
                        "
                    >
                        <CodeBracketIcon
                            class="size-4 text-theme-700 dark:text-zinc-200"
                        />
                        <span class="w-30 text-center"> App 原始碼 </span>
                    </button>
                </div>
                <p
                    class="mt-3 text-sm leading-relaxed text-theme-700 dark:text-zinc-300"
                >
                    本程式為 AGPL-3.0-or-later
                    開放原始碼授權軟體。任何人均可自由取得原始碼、修改、編譯、再發佈，惟須維持相同授權方式。
                </p>
            </section>

            <section
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <h3
                    class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                >
                    鳴謝
                </h3>
                <div
                    class="prose mt-2 text-sm leading-relaxed text-theme-700 prose-theme dark:text-zinc-300 dark:prose-zinc dark:prose-invert"
                >
                    <p>
                        Alt UU 的誕生離不開許多人的幫助，特別是 Laravel 社群與
                        Vue 社群豐富的生態，以及所有參與 Alt UU
                        公開測試的同學。<br />
                        以下是一些 Alt UU
                        使用到的開放原始碼專案與其授權。您應該可以在本專案的
                        GitHub Repository 內找到更多資訊。
                    </p>
                    <ul>
                        <li>Laravel (MIT License)</li>
                        <li>Vue (MIT License)</li>
                        <li>Vue Router (MIT License)</li>
                        <li>Tailwind CSS (MIT License)</li>
                        <li>Heroicons (MIT License)</li>
                        <li>NativePHP (MIT License)</li>
                    </ul>
                </div>
            </section>
        </div>

        <AndroidBottomControlBackground />
    </AppLayout>
</template>
