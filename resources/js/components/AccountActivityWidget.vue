<script setup lang="ts">
import { ChartBarIcon } from '@heroicons/vue/24/outline';
import { SparklesIcon } from '@heroicons/vue/24/solid';
import { onActivated, onMounted, ref, watch } from 'vue';
import ActivityHeatmap from '@/components/ActivityHeatmap.vue';
import PremiumBadge from '@/components/PremiumBadge.vue';
import { apiFetch } from '@/composables/useApi';
import { useSubscriptionStore } from '@/stores/subscription';
import type { ActivityHeatmap as ActivityHeatmapData } from '@/types';

const subscriptionStore = useSubscriptionStore();

const activity = ref<ActivityHeatmapData | null>(null);
const isActivityLoading = ref(false);
const showAllAccountsActivity = ref(false);

function pseudoRandom(seed: number): number {
    const value = Math.sin(seed * 12.9898) * 43758.5453;

    return value - Math.floor(value);
}

function buildSampleActivity(): ActivityHeatmapData {
    const totalDays = 182;
    const today = new Date();
    const days: ActivityHeatmapData['days'] = [];

    for (let i = totalDays - 1; i >= 0; i -= 1) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        const roll = pseudoRandom(i);
        const seconds = roll < 0.35 ? 0 : Math.round(roll * 5400);

        days.push({ date: date.toISOString().slice(0, 10), seconds });
    }

    return {
        days,
        currentStreak: 6,
        longestStreak: 18,
        longestStudyDaySeconds: 5400,
        longestStudyDayDate: days.at(-8)?.date ?? null,
        hasMultipleAccounts: false,
    };
}

const sampleActivity = buildSampleActivity();

async function loadActivity(): Promise<void> {
    isActivityLoading.value = true;

    try {
        activity.value = await apiFetch<ActivityHeatmapData>(
            `/api/accounts/activity?allAccounts=${showAllAccountsActivity.value ? '1' : '0'}`,
        );
    } catch {
        activity.value = null;
    } finally {
        isActivityLoading.value = false;
    }
}

async function onToggleAllAccounts(value: boolean): Promise<void> {
    showAllAccountsActivity.value = value;
    await loadActivity();
}

watch(
    () => subscriptionStore.active,
    (active) => {
        if (active) {
            void loadActivity();
        }
    },
);

let hasMounted = false;

onMounted(async () => {
    hasMounted = true;
    await subscriptionStore.loadStatus();

    if (subscriptionStore.active) {
        void loadActivity();
    }
});

// The account page is kept alive under <KeepAlive>, so revisiting it skips
// onMounted — refresh the activity heatmap here instead.
onActivated(async () => {
    if (!hasMounted) {
        return;
    }

    await subscriptionStore.loadStatus();

    if (subscriptionStore.active) {
        void loadActivity();
    }
});
</script>

<template>
    <div
        class="relative overflow-hidden rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
    >
        <div class="mb-3 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
                <ChartBarIcon
                    class="size-5 text-theme-700 dark:text-zinc-400"
                />
                <p
                    class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                >
                    學習活動
                </p>
                <PremiumBadge v-if="!subscriptionStore.active" />
            </div>

            <div
                v-if="subscriptionStore.active && activity?.hasMultipleAccounts"
                class="inline-flex rounded-full border border-theme-200 bg-theme-50 p-0.5 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-800"
            >
                <button
                    type="button"
                    class="rounded-full px-3 py-1 transition"
                    :class="
                        !showAllAccountsActivity
                            ? 'bg-white text-theme-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                            : 'text-theme-700 dark:text-zinc-400'
                    "
                    @click="onToggleAllAccounts(false)"
                >
                    目前帳號
                </button>
                <button
                    type="button"
                    class="rounded-full px-3 py-1 transition"
                    :class="
                        showAllAccountsActivity
                            ? 'bg-white text-theme-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                            : 'text-theme-700 dark:text-zinc-400'
                    "
                    @click="onToggleAllAccounts(true)"
                >
                    所有帳號
                </button>
            </div>
        </div>

        <template v-if="subscriptionStore.active">
            <ActivityHeatmap v-if="activity" v-bind="activity" />
            <div v-else-if="isActivityLoading" class="space-y-4">
                <div class="space-y-2">
                    <div class="flex space-x-2">
                        <div
                            v-for="n in 2"
                            :key="n"
                            class="flex w-1/2 items-center justify-between gap-1 rounded-lg border border-theme-200 bg-theme-50 p-3 dark:border-zinc-700 dark:bg-zinc-800"
                        >
                            <div
                                class="h-8 w-8 shrink-0 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
                            />
                            <div class="w-full space-y-2">
                                <div
                                    class="ml-auto h-6 w-10 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
                                />
                                <div
                                    class="ml-auto h-8 w-16 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
                                />
                            </div>
                        </div>
                    </div>
                    <div
                        class="flex items-center justify-between gap-3 rounded-lg border border-theme-200 bg-theme-50 p-3 dark:border-zinc-700 dark:bg-zinc-800"
                    >
                        <div
                            class="h-8 w-8 shrink-0 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
                        />
                        <div class="space-y-2">
                            <div
                                class="ml-auto h-6 w-24 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
                            />
                            <div
                                class="ml-auto h-4 w-16 animate-pulse rounded bg-theme-200 dark:bg-zinc-700"
                            />
                        </div>
                    </div>
                </div>
                <div
                    class="h-32 animate-pulse rounded-lg bg-theme-100 dark:bg-zinc-800"
                />
            </div>
            <p v-else class="text-sm text-theme-700 dark:text-zinc-400">
                無法載入學習活動資料。
            </p>
        </template>
        <ActivityHeatmap v-else v-bind="sampleActivity" />

        <div
            v-if="!subscriptionStore.active"
            class="pointer-events-none absolute top-3 right-3 rounded-full bg-theme-900/80 px-2 py-0.5 text-[10px] font-medium text-theme-50 dark:bg-zinc-100/80 dark:text-zinc-900"
        >
            範例資料
        </div>

        <div
            v-if="!subscriptionStore.active"
            class="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 rounded-b-xl bg-gradient-to-t from-white via-white/95 to-transparent p-4 pt-10 text-center dark:from-zinc-900 dark:via-zinc-900/95"
        >
            <SparklesIcon class="size-6 text-amber-600 dark:text-amber-400" />
            <p class="text-sm font-semibold text-theme-900 dark:text-zinc-100">
                學習活動為 Alt UU+ 專屬功能
            </p>
            <p class="text-xs text-theme-700 dark:text-zinc-400">
                追蹤你的學習連續天數與每日學習時間，如上方範例所示。訂閱即可解鎖你的真實學習紀錄。
            </p>
            <router-link
                :to="{ name: 'courses.account.subscription' }"
                class="rounded-lg bg-theme-700 px-3 py-1.5 text-sm font-medium text-theme-50 transition hover:bg-theme-800 dark:bg-theme-800 dark:hover:bg-theme-700"
            >
                升級
            </router-link>
        </div>
    </div>
</template>
