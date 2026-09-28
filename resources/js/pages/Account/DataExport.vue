<script setup lang="ts">
import { ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/vue/24/outline';
import { SparklesIcon } from '@heroicons/vue/24/solid';
import { onMounted, ref } from 'vue';
import AppLayout from '@/components/AppLayout.vue';
import BackButton from '@/components/BackButton.vue';
import PremiumBadge from '@/components/PremiumBadge.vue';
import { apiFetch } from '@/composables/useApi';
import { useTitle } from '@/composables/useTitle';
import {
    downloadAttachmentWithNativeBridge,
    isNativeAttachmentBridgeAvailable,
} from '@/lib/nativeAttachment';
import { useSubscriptionStore } from '@/stores/subscription';
import type { DataImportResult } from '@/types';

useTitle('資料匯出入');

const subscriptionStore = useSubscriptionStore();

const showUpgradeModal = ref(false);

onMounted(async () => {
    await subscriptionStore.loadStatus();
});

function requiresSubscription(): boolean {
    if (!subscriptionStore.active) {
        showUpgradeModal.value = true;

        return true;
    }

    return false;
}

// --- Export / import ---

const exportUrl = '/api/data-export';

const isExporting = ref(false);
const exportError = ref<string | null>(null);

function exportFilename(): string {
    return `alt-uu-data-export-${new Date().toISOString().slice(0, 10)}.json`;
}

async function onExport(): Promise<void> {
    if (isExporting.value) {
        return;
    }

    isExporting.value = true;
    exportError.value = null;

    try {
        if (isNativeAttachmentBridgeAvailable()) {
            const ok = await downloadAttachmentWithNativeBridge(
                exportUrl,
                exportFilename(),
            );

            if (!ok) {
                throw new Error('匯出失敗，請稍後再試。');
            }
        } else {
            const link = document.createElement('a');
            link.href = exportUrl;
            link.download = exportFilename();
            document.body.appendChild(link);
            link.click();
            link.remove();
        }

        window.showFlashMessage('已匯出資料', 'success');
    } catch (error) {
        exportError.value =
            error instanceof Error ? error.message : '匯出失敗，請稍後再試。';
    } finally {
        isExporting.value = false;
    }
}

const isImporting = ref(false);
const importError = ref<string | null>(null);
const importResult = ref<DataImportResult | null>(null);

function onImportLabelClick(event: MouseEvent): void {
    if (requiresSubscription()) {
        event.preventDefault();
    }
}

async function onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || requiresSubscription()) {
        input.value = '';

        return;
    }

    isImporting.value = true;
    importError.value = null;
    importResult.value = null;

    try {
        const text = await file.text();
        const payload = JSON.parse(text);

        importResult.value = await apiFetch<DataImportResult>(
            '/api/data-export/import',
            {
                method: 'POST',
                body: JSON.stringify(payload),
            },
        );

        window.showFlashMessage('已匯入資料', 'success');
    } catch (error) {
        importError.value =
            error instanceof Error
                ? error.message
                : '匯入失敗，請確認檔案格式是否正確。';
    } finally {
        isImporting.value = false;
        input.value = '';
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
                    <BackButton href="/courses/account" />

                    <h2 class="text-lg font-semibold">資料匯出入</h2>
                </div>
            </div>
        </div>

        <div
            class="mx-auto w-full max-w-2xl space-y-4 px-4 pb-[calc(var(--inset-bottom,0px)+2rem)]"
        >
            <div
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <h3
                    class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                >
                    匯出資料
                </h3>
                <p
                    class="mt-1 text-xs leading-relaxed text-theme-700 dark:text-zinc-400"
                >
                    將裝置上所有帳號的學習紀錄（播放進度與每日學習活動）匯出為
                    JSON 檔案，方便備份或轉移到其他裝置。
                </p>

                <button
                    type="button"
                    class="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm font-medium text-theme-800 transition hover:border-theme-400 hover:bg-theme-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                    :disabled="isExporting"
                    @click="onExport"
                >
                    <ArrowDownTrayIcon class="size-4" />
                    <span>{{
                        isExporting ? '匯出中…' : '匯出為 JSON 檔案'
                    }}</span>
                </button>

                <p
                    v-if="exportError"
                    class="mt-3 text-xs text-rose-600 dark:text-rose-400"
                >
                    {{ exportError }}
                </p>
            </div>

            <div
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <div class="flex items-center gap-1.5">
                    <h3
                        class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                    >
                        匯入資料
                    </h3>
                    <PremiumBadge v-if="!subscriptionStore.active" />
                </div>
                <p
                    class="mt-1 text-xs leading-relaxed text-theme-700 dark:text-zinc-400"
                >
                    選擇先前匯出的 JSON
                    檔案以還原學習紀錄。只有使用者名稱與本裝置帳號相符的資料才會被匯入。
                </p>

                <label
                    class="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm font-medium text-theme-800 transition hover:border-theme-400 hover:bg-theme-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                    :class="{
                        'pointer-events-none opacity-60': isImporting,
                    }"
                    @click="onImportLabelClick"
                >
                    <ArrowUpTrayIcon class="size-4" />
                    <span>{{ isImporting ? '匯入中…' : '選擇檔案匯入' }}</span>
                    <input
                        type="file"
                        accept="application/json,.json"
                        class="hidden"
                        :disabled="isImporting"
                        @change="onFileSelected"
                    />
                </label>

                <p
                    v-if="importError"
                    class="mt-3 text-xs text-rose-600 dark:text-rose-400"
                >
                    {{ importError }}
                </p>

                <div
                    v-if="importResult"
                    class="mt-3 space-y-1 text-xs text-emerald-700 dark:text-emerald-300"
                >
                    <p>
                        已匯入 {{ importResult.importedAccountsCount }}
                        個帳號的資料，共
                        {{ importResult.importedPlaybackProgressCount }}
                        筆播放進度、
                        {{ importResult.importedAccountDailyActivitiesCount }}
                        筆每日學習活動。
                    </p>
                    <p v-if="importResult.skippedUsernames.length > 0">
                        以下使用者名稱在本裝置找不到對應帳號，已略過：{{
                            importResult.skippedUsernames.join('、')
                        }}
                    </p>
                </div>
            </div>

            <div
                v-if="!subscriptionStore.active"
                class="relative overflow-hidden rounded-xl bg-linear-to-br from-amber-500 via-orange-500 to-theme-700 p-4 text-white dark:from-amber-600 dark:via-orange-700 dark:to-zinc-900"
            >
                <SparklesIcon
                    class="pointer-events-none absolute -top-4 -right-4 size-24 text-white/15"
                />

                <p class="relative text-sm font-medium">
                    想要匯入學習紀錄嗎？<br />
                    訂閱 Alt UU+ 即可解鎖此功能與更多內容。
                </p>

                <router-link
                    :to="{ name: 'courses.account.subscription' }"
                    class="relative mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-white"
                >
                    <SparklesIcon class="size-3.5" />
                    訂閱 Alt UU+
                </router-link>
            </div>
        </div>

        <Teleport to="body">
            <div
                v-if="showUpgradeModal"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                @click.self="showUpgradeModal = false"
            >
                <div
                    class="w-full max-w-sm rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
                >
                    <div
                        class="flex flex-col items-center gap-2 px-5 py-6 text-center"
                    >
                        <SparklesIcon
                            class="size-6 text-amber-600 dark:text-amber-400"
                        />
                        <h3
                            class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                        >
                            資料匯入為 Alt UU+ 專屬功能
                        </h3>
                        <p class="text-xs text-theme-700 dark:text-zinc-400">
                            升級為 Alt UU+ 即可啟用匯入學習紀錄。
                        </p>
                    </div>

                    <div
                        class="flex justify-end gap-2 border-t border-theme-200 px-5 py-4 dark:border-zinc-700"
                    >
                        <button
                            type="button"
                            class="rounded-xl border border-theme-300 bg-white px-4 py-2 text-sm font-semibold text-theme-700 transition hover:bg-theme-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                            @click="showUpgradeModal = false"
                        >
                            關閉
                        </button>
                        <router-link
                            :to="{ name: 'courses.account.subscription' }"
                            class="rounded-xl bg-theme-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-theme-800 dark:bg-theme-800 dark:hover:bg-theme-700"
                            @click="showUpgradeModal = false"
                        >
                            升級
                        </router-link>
                    </div>
                </div>
            </div>
        </Teleport>
    </AppLayout>
</template>
