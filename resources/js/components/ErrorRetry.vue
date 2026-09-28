<script setup lang="ts">
import { ArrowPathIcon } from '@heroicons/vue/24/outline';
import { computed, ref } from 'vue';
import type { ApiError } from '@/lib/apiError';
import { copyToClipboard } from '@/lib/clipboard';
import { useConnectivityStore } from '@/stores/connectivity';

const props = withDefaults(
    defineProps<{
        message: string;
        retrying?: boolean;
        /**
         * The structured failure behind `message`. Optional so existing call
         * sites keep working; pass it to get the code and detail panel.
         */
        detail?: ApiError | null;
    }>(),
    {
        retrying: false,
        detail: null,
    },
);

const emit = defineEmits<{
    retry: [];
}>();

const connectivity = useConnectivityStore();
const expanded = ref(false);
const copied = ref(false);

/**
 * Shown next to the message rather than hidden behind the disclosure, so a
 * screenshot on its own already says which part of the app failed and how.
 */
const displayCode = computed(() => props.detail?.displayCode ?? null);

/**
 * Repeated retries against an unreachable server or school system suggest
 * a connectivity problem; a plain app error is not something diagnostics
 * can explain.
 */
function onRetry(): void {
    const stage = props.detail?.stage;

    if (!props.detail || stage === 'network' || stage === 'upstream') {
        connectivity.noteRetry();
    }

    emit('retry');
}

async function onCopy(): Promise<void> {
    if (!props.detail) {
        return;
    }

    copied.value = await copyToClipboard(props.detail.toReport());

    if (copied.value) {
        window.setTimeout(() => {
            copied.value = false;
        }, 2000);
    }
}
</script>

<template>
    <div
        class="rounded-xl border border-dashed border-rose-300 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300"
    >
        <p>
            {{ message }}
            <span
                v-if="displayCode"
                class="ml-1 rounded bg-rose-100 px-1.5 py-0.5 font-mono text-xs text-rose-800 dark:bg-rose-900 dark:text-rose-200"
                >[{{ displayCode }}]</span
            >
        </p>

        <div class="mt-3 flex flex-wrap items-center gap-2">
            <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-700 dark:bg-zinc-900 dark:text-rose-300 dark:hover:border-rose-600 dark:hover:bg-zinc-800"
                :disabled="retrying"
                @click="onRetry"
            >
                <ArrowPathIcon
                    class="size-4"
                    :class="{ 'animate-spin': retrying }"
                />
                <span>{{ retrying ? '重試中…' : '重試' }}</span>
            </button>

            <button
                v-if="detail"
                type="button"
                class="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-rose-700 underline underline-offset-2 hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-100"
                :aria-expanded="expanded"
                @click="expanded = !expanded"
            >
                {{ expanded ? '隱藏詳細資料' : '詳細資料' }}
            </button>
        </div>

        <dl
            v-if="detail && expanded"
            class="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-rose-200 pt-3 text-xs dark:border-rose-800"
        >
            <dt class="font-medium">狀況</dt>
            <dd>{{ detail.stageLabel }}</dd>

            <dt class="font-medium">項目</dt>
            <dd>{{ detail.operation.label }}</dd>

            <dt class="font-medium">請求</dt>
            <dd class="font-mono break-all">
                {{ detail.method }} {{ detail.url }}
                <span v-if="detail.durationMs !== null">
                    · {{ detail.durationMs }}ms</span
                >
            </dd>

            <template v-if="detail.status !== null">
                <dt class="font-medium">狀態碼</dt>
                <dd class="font-mono">{{ detail.status }}</dd>
            </template>

            <template v-if="detail.upstreamStatus !== null">
                <dt class="font-medium">學校系統</dt>
                <dd class="font-mono">回應 {{ detail.upstreamStatus }}</dd>
            </template>

            <template v-if="detail.requestId">
                <dt class="font-medium">識別碼</dt>
                <dd class="font-mono">{{ detail.requestId }}</dd>
            </template>

            <template v-if="detail.serverException">
                <dt class="font-medium">伺服器</dt>
                <dd class="font-mono break-all">
                    {{ detail.serverException.class }}:
                    {{ detail.serverException.message }}
                    <br />
                    {{ detail.serverException.file }}:{{
                        detail.serverException.line
                    }}
                </dd>
            </template>
        </dl>

        <div v-if="detail && expanded" class="mt-3 flex flex-wrap gap-2">
            <button
                type="button"
                class="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-zinc-800"
                @click="onCopy"
            >
                {{ copied ? '已複製' : '複製診斷資料' }}
            </button>
            <router-link
                :to="{ name: 'settings.diagnostics-log' }"
                class="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-zinc-800"
            >
                開啟診斷記錄
            </router-link>
        </div>
    </div>
</template>
