<script setup lang="ts">
import {
    ArrowPathIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    XCircleIcon,
} from '@heroicons/vue/24/outline';
import { computed, onMounted } from 'vue';
import AndroidBottomControlBackground from '@/components/AndroidBottomControlBackground.vue';
import AppLayout from '@/components/AppLayout.vue';
import BackButton from '@/components/BackButton.vue';
import ConnectivityServiceRow from '@/components/ConnectivityServiceRow.vue';
import { useConnectivityDiagnostics } from '@/composables/useConnectivityDiagnostics';
import { useTitle } from '@/composables/useTitle';

useTitle('連線診斷');

const {
    rows,
    referenceRows,
    isChecking,
    isCheckingReference,
    error,
    referenceError,
    deviceNetwork,
    runCheck,
    runReferenceCheck,
} = useConnectivityDiagnostics();

const networkTypeLabel: Record<string, string> = {
    wifi: 'Wi-Fi',
    cellular: '行動網路',
    ethernet: '乙太網路',
    unknown: '未知',
};

const overviewMessages: Partial<Record<string, string>> = {
    hungu: '由於無法連線到數位學習平台，因此無法使用 Alt UU',
    school_portal:
        '由於無法連線到教務行政資訊系統，因此無法使用部份功能如下載作業或查詢成績。',
    nou_tools:
        '由於無法連線到 NOU 小幫手，因此部份功能如視訊面授資訊、學校行事曆，以及考古題等功能將無法使用。',
    iap: '由於無法連線到 Alt UU+ 服務，因此 Alt UU+ 功能無法使用。若您已訂閱但未顯示您的訂閱狀態，可於稍後可正常連線時按一下訂閱頁中的「恢復購買」來恢復您的訂閱狀態。',
};

const isOffline = computed(
    () => deviceNetwork.value !== null && !deviceNetwork.value.connected,
);

const overview = computed(() => {
    if (deviceNetwork.value && !deviceNetwork.value.connected) {
        return {
            level: 'error' as const,
            messages: [
                '您的裝置目前沒有網路連線，請確認您已連線到行動網路（4G / 5G 等）或無線網路（Wi-Fi），方可使用 Alt-UU。',
            ],
        };
    }

    if (
        rows.value.length === 0 ||
        rows.value.some((row) => row.status !== 'done')
    ) {
        return { level: 'loading' as const, messages: [] };
    }

    const unreachable = rows.value.filter(
        (row) => row.status === 'done' && !row.reachable,
    );

    const messages = unreachable
        .map((row) => overviewMessages[row.service])
        .filter((message): message is string => Boolean(message));

    if (messages.length === 0) {
        return { level: 'ok' as const, messages: [] };
    }

    const hunguUnreachable = unreachable.some((row) => row.service === 'hungu');

    return {
        level: hunguUnreachable ? ('error' as const) : ('warning' as const),
        messages,
    };
});

onMounted(() => {
    void runCheck();
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

                    <h2 class="text-lg font-semibold">連線診斷</h2>
                </div>
            </div>
        </div>

        <div class="mx-auto mt-6 w-full max-w-4xl space-y-4 px-4 pb-24">
            <section
                class="shadow-smborder-theme-200 flex min-h-32 items-center rounded-xl border border-theme-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
            >
                <div class="flex items-center gap-3">
                    <ArrowPathIcon
                        v-if="overview.level === 'loading'"
                        class="size-6 shrink-0 animate-spin text-theme-700 dark:text-zinc-400"
                    />
                    <CheckCircleIcon
                        v-else-if="overview.level === 'ok'"
                        class="size-6 shrink-0 text-emerald-600 dark:text-emerald-400"
                    />
                    <ExclamationTriangleIcon
                        v-else-if="overview.level === 'warning'"
                        class="size-6 shrink-0 text-amber-600 dark:text-amber-400"
                    />
                    <XCircleIcon
                        v-else
                        class="size-6 shrink-0 text-rose-600 dark:text-rose-400"
                    />

                    <div class="space-y-1">
                        <p
                            v-if="overview.level === 'loading'"
                            class="text-sm text-theme-700 dark:text-zinc-400"
                        >
                            正在檢查各項服務連線狀態…
                        </p>
                        <p
                            v-else-if="overview.level === 'ok'"
                            class="text-sm text-theme-700 dark:text-zinc-300"
                        >
                            所有服務均可正常連線。
                        </p>
                        <p
                            v-for="message in overview.messages"
                            v-else
                            :key="message"
                            class="text-sm text-theme-700 dark:text-zinc-300"
                        >
                            {{ message }}
                        </p>
                    </div>
                </div>
            </section>

            <template v-if="!isOffline">
                <div class="flex items-center justify-between gap-4">
                    <p class="text-sm text-theme-700 dark:text-zinc-400">
                        檢查 Alt UU
                        所依賴的各項服務目前是否可正常連線，協助您判斷連線問題是否來自您的網路。
                    </p>

                    <button
                        type="button"
                        class="inline-flex shrink-0 items-center gap-2 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm font-medium text-theme-800 transition hover:border-theme-400 hover:bg-theme-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                        :disabled="isChecking"
                        @click="runCheck"
                    >
                        <ArrowPathIcon
                            class="size-4"
                            :class="{ 'animate-spin': isChecking }"
                        />
                        <span>{{ isChecking ? '檢查中…' : '重新檢查' }}</span>
                    </button>
                </div>

                <p
                    v-if="error"
                    class="text-sm text-rose-700 dark:text-rose-300"
                >
                    {{ error }}
                </p>

                <section
                    v-if="deviceNetwork"
                    class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <h3
                                class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                            >
                                裝置網路狀態
                            </h3>
                            <p
                                class="mt-1 text-xs text-theme-700 dark:text-zinc-400"
                            >
                                <span v-if="deviceNetwork.connected">
                                    已連線（{{
                                        networkTypeLabel[deviceNetwork.type] ??
                                        deviceNetwork.type
                                    }}）
                                    <span v-if="deviceNetwork.isExpensive">
                                        ・按流量計費
                                    </span>
                                    <span v-if="deviceNetwork.isConstrained">
                                        ・低數據模式
                                    </span>
                                </span>
                                <span v-else>裝置目前無網路連線</span>
                            </p>
                        </div>

                        <CheckCircleIcon
                            v-if="deviceNetwork.connected"
                            class="size-6 shrink-0 text-emerald-600 dark:text-emerald-400"
                        />
                        <XCircleIcon
                            v-else
                            class="size-6 shrink-0 text-rose-600 dark:text-rose-400"
                        />
                    </div>
                </section>

                <ConnectivityServiceRow
                    v-for="row in rows"
                    :key="row.service"
                    :row="row"
                />

                <div
                    class="border-t border-theme-200 pt-4 dark:border-zinc-700"
                >
                    <h3
                        class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                    >
                        網際網路連線（選用）
                    </h3>
                    <div class="flex items-start justify-between gap-4">
                        <p
                            class="mt-1 text-xs text-theme-700 dark:text-zinc-400"
                        >
                            透過檢查 Google、Cloudflare、Apple
                            等外部服務，協助判斷問題是否來自您的網際網路連線，而非
                            Alt UU 本身。
                        </p>

                        <button
                            type="button"
                            class="inline-flex shrink-0 items-center gap-2 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm font-medium text-theme-800 transition hover:border-theme-400 hover:bg-theme-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                            :disabled="isCheckingReference"
                            @click="runReferenceCheck"
                        >
                            <ArrowPathIcon
                                class="size-4"
                                :class="{
                                    'animate-spin': isCheckingReference,
                                }"
                            />
                            <span>
                                {{
                                    isCheckingReference
                                        ? '檢查中…'
                                        : '檢查網際網路連線'
                                }}
                            </span>
                        </button>
                    </div>
                </div>

                <p
                    v-if="referenceError"
                    class="text-sm text-rose-700 dark:text-rose-300"
                >
                    {{ referenceError }}
                </p>

                <ConnectivityServiceRow
                    v-for="row in referenceRows"
                    :key="row.service"
                    :row="row"
                />
            </template>
        </div>

        <AndroidBottomControlBackground />
    </AppLayout>
</template>
