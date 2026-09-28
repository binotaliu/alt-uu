<script setup lang="ts">
import { ChevronDownIcon, UserCircleIcon } from '@heroicons/vue/24/outline';
import { SparklesIcon } from '@heroicons/vue/24/solid';
import { computed, onActivated, onMounted } from 'vue';
import AccountActivityWidget from '@/components/AccountActivityWidget.vue';
import DataImportExportWidget from '@/components/DataImportExportWidget.vue';
import { useAppConfigStore } from '@/stores/appConfig';
import { useSubscriptionStore } from '@/stores/subscription';

const configStore = useAppConfigStore();
const subscriptionStore = useSubscriptionStore();
const altUuPlusDisabled = computed(() =>
    Boolean(configStore.altUuPlusDisabled),
);

let hasMounted = false;

onMounted(async () => {
    hasMounted = true;
    void configStore.loadConfig();
    void subscriptionStore.loadStatus(true);
});

// Revisiting this tab under <KeepAlive> skips onMounted, so refresh the
// force-refreshed subscription status here instead.
onActivated(() => {
    if (!hasMounted) {
        return;
    }

    void subscriptionStore.loadStatus(true);
});

function formatExpiry(value: string | null): string {
    if (!value) {
        return '';
    }

    return new Date(value).toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}
</script>

<template>
    <div
        class="mx-auto w-full max-w-2xl space-y-4 px-4 pt-3 pb-[calc(var(--inset-bottom,0px)+7rem)] md:px-6 md:pt-4 md:pb-6"
    >
        <!-- Profile widget -->
        <div
            class="flex items-center gap-4 rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
            <img
                v-if="configStore.picture"
                :src="configStore.picture"
                alt=""
                draggable="false"
                class="size-14 rounded-full object-cover select-none [-webkit-touch-callout:none]"
            />
            <UserCircleIcon
                v-else
                class="size-14 text-theme-700 dark:text-zinc-500"
            />
            <div class="min-w-0 flex-1">
                <p
                    class="text-lg font-semibold text-theme-900 dark:text-zinc-100"
                >
                    {{ configStore.displayName ?? '學生' }}
                </p>
                <p
                    v-if="configStore.username"
                    class="text-sm text-theme-700 dark:text-zinc-400"
                >
                    {{ configStore.username }}
                </p>
            </div>

            <router-link
                :to="{ name: 'courses.account.accounts' }"
                class="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-theme-700 transition hover:bg-theme-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
                切換帳號
                <ChevronDownIcon class="size-4" />
            </router-link>
        </div>

        <!-- Grades / exam info links -->
        <div
            class="overflow-hidden rounded-xl border border-theme-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
            <router-link
                :to="{ name: 'courses.account.grades' }"
                class="flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-theme-900 transition hover:bg-theme-50 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
                我的成績
                <ChevronDownIcon
                    class="size-4 -rotate-90 text-theme-700 dark:text-zinc-500"
                />
            </router-link>
            <router-link
                :to="{ name: 'courses.account.exam-info' }"
                class="flex items-center justify-between gap-2 border-t border-theme-200 px-4 py-3 text-sm font-medium text-theme-900 transition hover:bg-theme-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
                考試資訊
                <ChevronDownIcon
                    class="size-4 -rotate-90 text-theme-700 dark:text-zinc-500"
                />
            </router-link>
        </div>

        <!-- Alt UU+ widget -->
        <div
            v-if="!altUuPlusDisabled"
            class="flex items-center justify-between gap-4 rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
            <div class="flex items-center gap-3">
                <SparklesIcon
                    class="size-6 text-amber-600 dark:text-amber-400"
                />
                <div>
                    <p
                        class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                    >
                        Alt UU+
                    </p>
                    <p class="text-xs text-theme-700 dark:text-zinc-400">
                        {{
                            subscriptionStore.active
                                ? `已訂閱${
                                      subscriptionStore.expiresAt
                                          ? '・下次續訂 ' +
                                            formatExpiry(
                                                subscriptionStore.expiresAt,
                                            )
                                          : ''
                                  }`
                                : '解鎖主題色、學習統計等更多功能'
                        }}
                    </p>
                </div>
            </div>

            <router-link
                :to="{ name: 'courses.account.subscription' }"
                class="shrink-0 rounded-lg bg-theme-700 px-3 py-1.5 text-sm font-medium text-theme-50 transition hover:bg-theme-800 dark:bg-theme-800 dark:hover:bg-theme-700"
            >
                {{ subscriptionStore.active ? '檢視方案' : '升級' }}
            </router-link>
        </div>

        <!-- Activity widget -->
        <AccountActivityWidget v-if="!altUuPlusDisabled" />

        <!-- Data import/export widget -->
        <DataImportExportWidget v-if="!altUuPlusDisabled" />
    </div>
</template>
