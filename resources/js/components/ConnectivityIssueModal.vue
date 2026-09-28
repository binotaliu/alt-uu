<script setup lang="ts">
import router from '@/router';
import { useConnectivityStore } from '@/stores/connectivity';

const connectivity = useConnectivityStore();

function dismiss(): void {
    connectivity.noteDiagnosticsRun();
    connectivity.close();
}

function goToDiagnostics(): void {
    connectivity.noteDiagnosticsRun();
    connectivity.close();
    router.push({ name: 'settings.diagnostics' });
}
</script>

<template>
    <Teleport to="body">
        <div
            v-if="connectivity.promptOpen"
            class="fixed inset-0 z-500 flex items-end justify-center bg-black/40 p-4 pb-[max(var(--inset-bottom,0px),1rem)] backdrop-blur-xs md:items-center"
            @click.self="dismiss()"
        >
            <div
                class="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
            >
                <div class="px-5 py-4">
                    <h3
                        class="text-lg font-semibold text-theme-900 dark:text-zinc-100"
                    >
                        連線似乎有問題
                    </h3>
                    <p class="mt-1 text-sm text-theme-700 dark:text-zinc-400">
                        Alt UU
                        目前無法正常連線至伺服器，可能是您的網路，也可能是學校系統暫時無法使用。您可以前往連線診斷頁面檢視詳細狀態。
                    </p>
                </div>

                <div
                    class="flex border-t border-theme-200 dark:border-zinc-700"
                >
                    <button
                        type="button"
                        class="flex-1 px-5 py-3 text-center text-sm text-theme-700 dark:text-zinc-300"
                        @click="dismiss()"
                    >
                        稍後再說
                    </button>
                    <button
                        type="button"
                        class="flex-1 border-l border-theme-200 px-5 py-3 text-center text-sm font-medium text-theme-900 dark:border-zinc-700 dark:text-zinc-100"
                        @click="goToDiagnostics()"
                    >
                        前往診斷
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>
