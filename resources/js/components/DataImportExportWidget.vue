<script setup lang="ts">
import { ArrowsRightLeftIcon } from '@heroicons/vue/24/outline';
</script>

<template>
    <div
        class="flex items-center justify-between gap-4 rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
    >
        <div class="flex items-center gap-3">
            <ArrowsRightLeftIcon
                class="size-6 text-theme-700 dark:text-zinc-400"
            />
            <div>
                <p
                    class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                >
                    匯入/匯出資料
                </p>
                <p class="text-xs text-theme-700 dark:text-zinc-400">
                    備份學習紀錄，或轉移到其他裝置
                </p>
            </div>
        </div>

        <router-link
            :to="{ name: 'courses.account.data-export' }"
            class="shrink-0 rounded-lg border border-theme-300 bg-theme-50 px-3 py-1.5 text-sm font-medium text-theme-800 transition hover:border-theme-400 hover:bg-theme-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
        >
            進行
        </router-link>
    </div>
</template>
