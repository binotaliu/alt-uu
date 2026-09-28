<script setup lang="ts">
import {
    ArrowPathIcon,
    CheckCircleIcon,
    XCircleIcon,
} from '@heroicons/vue/24/outline';
import type { ConnectivityServiceRow } from '@/composables/useConnectivityDiagnostics';

defineProps<{ row: ConnectivityServiceRow }>();
</script>

<template>
    <section
        class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
    >
        <div class="flex items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
                <h3
                    class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                >
                    {{ row.label }}
                </h3>
                <p
                    class="mt-1 truncate text-xs text-theme-700 dark:text-zinc-400"
                >
                    <span v-if="row.status === 'pending'">尚未執行檢查</span>
                    <span v-else-if="row.status === 'checking'"> 檢查中… </span>
                    <span v-else-if="row.reachable">
                        回應時間 {{ row.latencyMs }}ms（狀態碼
                        {{ row.statusCode }}）
                    </span>
                    <span v-else>
                        {{
                            row.error ??
                            `無法連線（狀態碼 ${row.statusCode ?? '無回應'}）`
                        }}
                    </span>
                </p>
            </div>

            <ArrowPathIcon
                v-if="row.status === 'checking'"
                class="size-6 shrink-0 animate-spin text-theme-700 dark:text-zinc-400"
            />
            <CheckCircleIcon
                v-else-if="row.status === 'done' && row.reachable"
                class="size-6 shrink-0 text-emerald-600 dark:text-emerald-400"
            />
            <XCircleIcon
                v-else-if="row.status === 'done'"
                class="size-6 shrink-0 text-rose-600 dark:text-rose-400"
            />
        </div>
    </section>
</template>
