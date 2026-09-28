<script setup lang="ts">
import { CheckCircleIcon } from '@heroicons/vue/24/outline';
import { SparklesIcon } from '@heroicons/vue/24/solid';
import { computed, onMounted } from 'vue';
import { Browser } from '#nativephp';
import AppLayout from '@/components/AppLayout.vue';
import BackButton from '@/components/BackButton.vue';
import { useSubscription } from '@/composables/useSubscription';
import { useTitle } from '@/composables/useTitle';
import { useSubscriptionStore } from '@/stores/subscription';

useTitle('Alt UU+');

const subscriptionStore = useSubscriptionStore();

const {
    products,
    isLoadingProducts,
    isPurchasing,
    isRestoring,
    fetchProducts,
    purchase,
    restore,
} = useSubscription();

const perks = [
    '切換不同顏色主題',
    '檢視每日學習統計',
    '支持 Alt UU 的開發與維護',
];

const currentProductName = computed(() => {
    const productId = subscriptionStore.productId;

    if (!productId) {
        return null;
    }

    const product = products.value.find((item) => item.id === productId);

    return product?.displayName ?? productId;
});

onMounted(async () => {
    fetchProducts();
    subscriptionStore.loadStatus(true);
});

async function onPurchase(productId: string): Promise<void> {
    try {
        const result = await purchase(productId);
        subscriptionStore.applyEntitlement(result);
    } catch {
        alert('購買失敗，請稍後重試');
    }
}

async function onRestore(): Promise<void> {
    try {
        const result = await restore();
        subscriptionStore.applyEntitlement(result);
    } catch {
        alert('還原購買失敗，請稍後重試');
    }
}

async function manageSubscription(): Promise<void> {
    const url = document.body.classList.contains('device-ios')
        ? 'itms-apps://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';

    await Browser.open(url);
}

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
    <AppLayout>
        <div
            class="sticky top-0 z-200 w-full bg-theme-100 py-1.5 pt-(--inset-top,4rem) pr-(--inset-right,0px) pl-[max(var(--inset-left,0px),var(--corner-inset-left,0px),1rem)] dark:bg-zinc-950"
        >
            <div
                class="flex items-center justify-between gap-2 pt-0.5 text-theme-900 dark:text-zinc-100"
            >
                <div class="flex items-center gap-2">
                    <BackButton href="/courses/account" />

                    <h2 class="text-lg font-semibold">Alt UU+</h2>
                </div>
            </div>
        </div>

        <div
            class="mx-auto w-full max-w-2xl space-y-4 px-4 pb-[calc(var(--inset-bottom,0px)+2rem)]"
        >
            <div
                class="overflow-hidden rounded-2xl border border-theme-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <div
                    class="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-theme-700 px-5 py-6 text-white dark:from-amber-600 dark:via-orange-700 dark:to-zinc-900"
                >
                    <SparklesIcon
                        class="pointer-events-none absolute -top-6 -right-6 size-32 text-white/15"
                    />

                    <div class="relative flex items-center gap-2">
                        <span
                            class="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur"
                        >
                            <SparklesIcon class="size-3.5" />
                            ALT UU+
                        </span>
                        <span
                            v-if="subscriptionStore.active"
                            class="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-amber-700"
                        >
                            已訂閱
                        </span>
                    </div>

                    <h3 class="relative mt-3 text-xl font-bold">
                        {{
                            subscriptionStore.active
                                ? '感謝你的支持！'
                                : '升級 Alt UU+'
                        }}
                    </h3>
                    <p class="relative mt-1 text-sm text-white/90">
                        {{
                            subscriptionStore.active
                                ? '你已解鎖 Alt UU+ 的所有功能'
                                : '解鎖多帳號切換等更多功能'
                        }}
                    </p>
                </div>

                <div class="p-5">
                    <div
                        v-if="!subscriptionStore.isLoaded"
                        class="py-2 text-center text-sm text-theme-700 dark:text-zinc-400"
                    >
                        載入訂閱狀態中…
                    </div>

                    <template v-else-if="subscriptionStore.active">
                        <dl class="space-y-2 text-sm">
                            <div
                                v-if="currentProductName"
                                class="flex items-center justify-between"
                            >
                                <dt class="text-theme-700 dark:text-zinc-400">
                                    目前方案
                                </dt>
                                <dd
                                    class="font-medium text-theme-900 dark:text-zinc-100"
                                >
                                    {{ currentProductName }}
                                </dd>
                            </div>
                            <div
                                v-if="subscriptionStore.expiresAt"
                                class="flex items-center justify-between"
                            >
                                <dt class="text-theme-700 dark:text-zinc-400">
                                    下次續訂日
                                </dt>
                                <dd
                                    class="font-medium text-theme-900 dark:text-zinc-100"
                                >
                                    {{
                                        formatExpiry(
                                            subscriptionStore.expiresAt,
                                        )
                                    }}
                                </dd>
                            </div>
                        </dl>

                        <button
                            @click="manageSubscription"
                            class="mt-4 w-full rounded-xl border border-theme-300 bg-white px-4 py-2 text-sm font-medium text-theme-700 transition hover:bg-theme-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        >
                            管理訂閱
                        </button>
                    </template>

                    <template v-else>
                        <ul class="space-y-2.5">
                            <li
                                v-for="perk in perks"
                                :key="perk"
                                class="flex items-start gap-2 text-sm text-theme-700 dark:text-zinc-300"
                            >
                                <CheckCircleIcon
                                    class="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                                />
                                {{ perk }}
                            </li>
                        </ul>

                        <div
                            v-if="isLoadingProducts"
                            class="mt-4 text-center text-sm text-theme-700 dark:text-zinc-400"
                        >
                            載入方案中…
                        </div>

                        <div v-else class="mt-4 space-y-2">
                            <button
                                v-for="product in products"
                                :key="product.id"
                                type="button"
                                @click="onPurchase(product.id)"
                                :disabled="isPurchasing"
                                class="flex w-full items-center justify-between rounded-xl border border-theme-200 p-3 text-left transition hover:border-amber-400 hover:bg-amber-50/50 disabled:opacity-50 dark:border-zinc-700 dark:hover:border-amber-500/50 dark:hover:bg-amber-500/5"
                            >
                                <div>
                                    <p
                                        class="font-medium text-theme-900 dark:text-zinc-100"
                                    >
                                        {{ product.displayName }}
                                    </p>
                                    <p
                                        class="text-xs text-theme-700 dark:text-zinc-400"
                                    >
                                        {{ product.description }}
                                    </p>
                                </div>
                                <div class="flex shrink-0 items-center gap-2">
                                    <span
                                        class="font-semibold text-theme-900 dark:text-zinc-100"
                                    >
                                        {{ product.displayPrice }}
                                    </span>
                                    <span
                                        class="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white"
                                    >
                                        訂閱
                                    </span>
                                </div>
                            </button>
                        </div>

                        <button
                            @click="onRestore"
                            :disabled="isRestoring"
                            class="mt-3 w-full text-center text-sm font-medium text-theme-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                        >
                            {{ isRestoring ? '還原中…' : '已購買過？還原購買' }}
                        </button>
                    </template>

                    <p
                        class="mt-4 border-t border-theme-200 pt-3 text-xs leading-relaxed text-theme-700 dark:border-zinc-700 dark:text-zinc-400"
                    >
                        Alt UU+ 是由 Alt UU
                        開發人員推出的訂閱服務，而非由學校提供。<br />
                        <span class="hidden in-[.device-android]:inline">
                            訂閱費用將通過 Google Play
                            進行收取，並自動續訂，除非你在本次計費週期結束前至少
                            24 小時取消。<br />
                            若要管理你的訂閱項目，請前往 Google Play
                            的帳號設定。
                        </span>
                        <span class="hidden in-[.device-ios]:inline">
                            訂閱費用將通過 Apple App Store
                            進行收取，並自動續訂，除非你在本次計費週期結束前至少
                            24 小時取消。<br />
                            若要管理你的訂閱項目，請前往 Apple App Store
                            的帳號設定。
                        </span>
                    </p>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
