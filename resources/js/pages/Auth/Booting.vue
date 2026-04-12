<script setup lang="ts">
import {
    AcademicCapIcon,
    ClockIcon,
    PuzzlePieceIcon,
} from '@heroicons/vue/24/outline';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import BackButton from '@/components/BackButton.vue';
import { apiFetch } from '@/composables/useApi';
import { useTitle } from '@/composables/useTitle';
import { restoreActiveMediaRoute } from '@/lib/restoreActiveMediaRoute';
import { useAppConfigStore } from '@/stores/appConfig';

useTitle('載入中');

interface BootstrapResponse {
    ok: boolean;
    redirect: string;
    showOnboarding: boolean;
    nouToolsIntegrationEnabled: boolean;
}

interface OnboardingSlide {
    id: string;
    title: string;
    description: string;
    note?: string;
    accentClass: string;
    panelClass: string;
    icon: typeof AcademicCapIcon;
}

const vueRouter = useRouter();
const configStore = useAppConfigStore();
const isLoading = ref(true);
const isSavingOnboarding = ref(false);
const isSavingNouToolsIntegration = ref(false);
const errorMessage = ref<string | null>(null);
const showOnboarding = ref(false);
const currentSlide = ref(0);
const redirectPath = ref('/courses');
const nouToolsIntegrationEnabled = ref(false);
const touchStartX = ref<number | null>(null);

const onboardingSlides: OnboardingSlide[] = [
    {
        id: 'about',
        title: '這是什麼 App？',
        description:
            'Alt UU 是一款由學生開發的，用於替代網頁版 UU 平台的瀏覽器 App。使用 Alt UU 能讓你在行動裝置上方便地存取 UU 平台的教材，隨時隨地學習。',
        note: '備註：你必須擁有有效的 UU 平台帳號，才可以使用本 App。',
        accentClass:
            'from-amber-200 via-orange-100 to-white dark:from-amber-500/30 dark:via-zinc-900 dark:to-zinc-950',
        panelClass:
            'bg-amber-500/15 text-amber-900 ring-amber-300/70 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/20',
        icon: AcademicCapIcon,
    },
    {
        id: 'study-time',
        title: '保存學習時數',
        description:
            '選擇教材後，你會在畫面的右上方看到計時器，這個時間表示你本次學習的時數。觀看完畢後，記得點擊左上角的返回按鈕來保存本次的學習時數喔！',
        accentClass:
            'from-sky-200 via-cyan-100 to-white dark:from-sky-500/30 dark:via-zinc-900 dark:to-zinc-950',
        panelClass:
            'bg-sky-500/15 text-sky-900 ring-sky-300/70 dark:bg-sky-400/10 dark:text-sky-100 dark:ring-sky-400/20',
        icon: ClockIcon,
    },
    {
        id: 'nou-tools',
        title: 'NOU 小幫手整合',
        description:
            'Alt UU 支援整合「NOU 小幫手」，開啟後即可看到學校行事曆、視訊面授、以及考古題等資訊。',
        note: '備註：開啟本功能時，將傳送部分詮釋資料（如課程名稱等）給「NOU 小幫手」，此資料不會與其他人分享，你可以選擇是否要開啟此功能。此功能可於稍後在 App 內的「設定」頁中開啟或關閉。',
        accentClass:
            'from-emerald-200 via-teal-100 to-white dark:from-emerald-500/30 dark:via-zinc-900 dark:to-zinc-950',
        panelClass:
            'bg-emerald-500/15 text-emerald-900 ring-emerald-300/70 dark:bg-emerald-400/10 dark:text-emerald-100 dark:ring-emerald-400/20',
        icon: PuzzlePieceIcon,
    },
];

const isLastSlide = computed(
    () => currentSlide.value === onboardingSlides.length - 1,
);

const slideTrackStyle = computed(() => ({
    transform: `translateX(-${currentSlide.value * 100}%)`,
}));

async function navigateToApp(): Promise<void> {
    if (await restoreActiveMediaRoute()) {
        return;
    }

    vueRouter.replace(
        new URL(redirectPath.value, window.location.origin).pathname,
    );
}

function goToPreviousSlide(): void {
    if (currentSlide.value > 0) {
        currentSlide.value -= 1;
    }
}

function onTouchStart(event: TouchEvent): void {
    touchStartX.value = event.changedTouches[0]?.clientX ?? null;
}

function onTouchEnd(event: TouchEvent): void {
    const startX = touchStartX.value;
    const endX = event.changedTouches[0]?.clientX ?? null;

    touchStartX.value = null;

    if (startX === null || endX === null) {
        return;
    }

    const deltaX = endX - startX;

    if (deltaX <= -48 && currentSlide.value < onboardingSlides.length - 1) {
        currentSlide.value += 1;

        return;
    }

    if (deltaX >= 48 && currentSlide.value > 0) {
        currentSlide.value -= 1;
    }
}

async function setNouToolsIntegrationEnabled(enabled: boolean): Promise<void> {
    const previousValue = nouToolsIntegrationEnabled.value;

    nouToolsIntegrationEnabled.value = enabled;
    isSavingNouToolsIntegration.value = true;
    errorMessage.value = null;

    try {
        await apiFetch<{ enabled: boolean }>('/api/preferences/nou-tools', {
            method: 'POST',
            body: JSON.stringify({ enabled }),
        });

        configStore.nouToolsIntegrationEnabled = enabled;
    } catch (error) {
        nouToolsIntegrationEnabled.value = previousValue;
        errorMessage.value =
            error instanceof Error
                ? error.message
                : '更新 NOU 小幫手整合失敗，請稍後再試。';
    } finally {
        isSavingNouToolsIntegration.value = false;
    }
}

async function finishOnboarding(): Promise<void> {
    isSavingOnboarding.value = true;
    errorMessage.value = null;

    try {
        await apiFetch<{ completed: boolean }>('/api/preferences/onboarding', {
            method: 'POST',
            body: JSON.stringify({ completed: true }),
        });

        // After onboarding is completed, proceed to bootstrap session
        showOnboarding.value = false;
        await bootstrapSession();
    } catch (error) {
        errorMessage.value =
            error instanceof Error
                ? error.message
                : '儲存 onboarding 狀態失敗，請稍後再試。';
    } finally {
        isSavingOnboarding.value = false;
    }
}

async function handleContinue(): Promise<void> {
    if (!isLastSlide.value) {
        currentSlide.value += 1;

        return;
    }

    await finishOnboarding();
}

async function bootstrapSession(): Promise<void> {
    isLoading.value = true;
    isSavingOnboarding.value = false;
    errorMessage.value = null;
    currentSlide.value = 0;

    try {
        const payload = await apiFetch<BootstrapResponse>(
            '/api/auth/bootstrap-session',
            {
                method: 'POST',
            },
        );

        if (payload.ok && payload.redirect) {
            redirectPath.value = payload.redirect;
            nouToolsIntegrationEnabled.value =
                payload.nouToolsIntegrationEnabled;
            configStore.nouToolsIntegrationEnabled =
                payload.nouToolsIntegrationEnabled;

            await navigateToApp();

            return;
        }

        errorMessage.value = '啟動驗證失敗，請稍後再試。';
    } catch (error) {
        errorMessage.value =
            error instanceof Error
                ? error.message
                : '啟動驗證失敗，請稍後再試。';
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    // Check if onboarding is needed based on window.showOnboarding
    const needsOnboarding =
        (window as typeof window & { showOnboarding?: boolean })
            .showOnboarding === true;

    if (needsOnboarding) {
        // Show onboarding directly without loading spinner
        showOnboarding.value = true;
        isLoading.value = false;
        errorMessage.value = null;
        currentSlide.value = 0;

        return;
    }

    // Otherwise, proceed directly to bootstrap session
    void bootstrapSession();
});
</script>

<template>
    <div
        class="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,oklch(0.98_0.03_40),white_45%,oklch(0.96_0.02_40))] px-5 py-8 font-sans antialiased dark:bg-zinc-950 dark:bg-none"
    >
        <div
            class="w-full max-w-md overflow-hidden rounded-4xl border border-warm-200 bg-white/85 dark:border-zinc-700 dark:bg-zinc-900/90"
        >
            <div v-if="isLoading" class="px-6 py-10 text-center sm:px-8">
                <div
                    class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-warm-700 border-t-transparent dark:border-zinc-300 dark:border-t-transparent"
                />

                <h1
                    class="text-lg font-semibold tracking-tight text-warm-900 dark:text-zinc-100"
                >
                    登入中
                </h1>
                <p class="mt-2 text-sm text-warm-700 dark:text-zinc-300">
                    連線中，請稍後
                </p>
            </div>

            <div v-else-if="showOnboarding" class="px-4 py-4 sm:px-5">
                <div class="flex items-center justify-between px-2 pt-1 pb-3">
                    <div>
                        <p
                            class="text-xs font-medium text-warm-500 dark:text-warm-300"
                        >
                            Welcome
                        </p>
                        <h1
                            class="text-warm-950 mt-1 text-xl font-semibold tracking-tight dark:text-zinc-50"
                        >
                            歡迎使用 Alt UU
                        </h1>
                    </div>
                    <p class="text-sm text-warm-600 dark:text-zinc-400">
                        {{ currentSlide + 1 }} / {{ onboardingSlides.length }}
                    </p>
                </div>

                <div
                    class="overflow-hidden rounded-[1.75rem] border border-warm-100 bg-warm-50/80 shadow-warm-100/60 dark:border-zinc-800 dark:bg-zinc-950/70 dark:shadow-black/20"
                    @touchstart.passive="onTouchStart"
                    @touchend.passive="onTouchEnd"
                >
                    <div
                        class="flex transition-transform duration-300 ease-out"
                        :style="slideTrackStyle"
                    >
                        <section
                            v-for="slide in onboardingSlides"
                            :key="slide.id"
                            class="w-full shrink-0 px-3 pt-3 pb-4"
                        >
                            <div
                                class="relative overflow-hidden p-1"
                                :class="slide.accentClass"
                            >
                                <div
                                    class="inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1"
                                    :class="slide.panelClass"
                                >
                                    <component
                                        :is="slide.icon"
                                        class="h-6 w-6"
                                    />
                                </div>
                            </div>

                            <div class="px-2 pt-5 pb-1">
                                <h2
                                    class="text-warm-950 text-2xl font-semibold tracking-tight dark:text-zinc-50"
                                >
                                    {{ slide.title }}
                                </h2>
                                <p
                                    class="mt-3 text-sm leading-7 text-warm-700 dark:text-zinc-300"
                                >
                                    {{ slide.description }}
                                </p>
                                <p
                                    v-if="slide.note"
                                    class="mt-3 text-xs leading-6 text-warm-600 dark:text-zinc-400"
                                >
                                    {{ slide.note }}
                                </p>

                                <div
                                    v-if="slide.id === 'nou-tools'"
                                    class="mt-4 rounded-2xl border border-warm-200/80 bg-white/90 p-4 dark:border-zinc-700 dark:bg-zinc-900/90"
                                >
                                    <div
                                        class="flex items-start justify-between gap-4"
                                    >
                                        <div>
                                            <h3
                                                class="text-sm font-semibold text-warm-900 dark:text-zinc-100"
                                            >
                                                開啟 NOU 小幫手整合
                                            </h3>
                                            <p
                                                class="mt-1 text-xs leading-relaxed text-warm-600 dark:text-zinc-400"
                                            >
                                                開啟後即可在課程內看到學校行事曆、視訊面授與考古題等資訊。
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition"
                                            :class="
                                                nouToolsIntegrationEnabled
                                                    ? 'bg-warm-700 dark:bg-warm-600'
                                                    : 'bg-warm-300 dark:bg-zinc-600'
                                            "
                                            :disabled="
                                                isSavingNouToolsIntegration
                                            "
                                            @click="
                                                setNouToolsIntegrationEnabled(
                                                    !nouToolsIntegrationEnabled,
                                                )
                                            "
                                        >
                                            <span class="sr-only"
                                                >切換 NOU 小幫手整合</span
                                            >
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
                                </div>
                                <div
                                    v-else-if="slide.id === 'study-time'"
                                    class="mt-8"
                                >
                                    <div
                                        class="overflow-hidden rounded-2xl border border-warm-200/80 bg-white/90 dark:border-zinc-700/80 dark:bg-zinc-900/90"
                                    >
                                        <div
                                            class="flex items-stretch border-b border-warm-200/80 dark:border-zinc-700/80"
                                        >
                                            <div
                                                class="flex flex-1 items-center gap-3 px-4 py-3.5"
                                            >
                                                <BackButton
                                                    class="pointer-events-none shrink-0 text-warm-700 dark:text-zinc-300"
                                                    disabled
                                                />
                                                <div
                                                    class="flex min-w-0 flex-1 flex-col gap-1"
                                                >
                                                    <div
                                                        class="h-5 w-20 rounded bg-warm-200 dark:bg-zinc-700"
                                                    ></div>
                                                    <div
                                                        class="h-4 w-32 rounded bg-warm-100 dark:bg-zinc-800"
                                                    ></div>
                                                </div>
                                            </div>
                                            <div
                                                class="flex shrink-0 items-center gap-2 px-4 py-3.5"
                                            >
                                                <div
                                                    class="inline-flex items-center gap-2 rounded-full bg-warm-100 px-3 py-1.5 text-xs font-medium text-warm-800 dark:bg-zinc-700/60 dark:text-zinc-200"
                                                >
                                                    <ClockIcon
                                                        class="h-4 w-4"
                                                    />
                                                    <span class="tabular-nums"
                                                        >12:34</span
                                                    >
                                                </div>
                                            </div>
                                        </div>
                                        <div
                                            class="flex items-center gap-2 bg-warm-50/50 px-4 py-3 text-sm text-warm-700 dark:bg-zinc-800/30 dark:text-zinc-300"
                                        >
                                            <div
                                                class="flex-1 leading-relaxed font-normal"
                                            >
                                                觀看完成記得按返回按鈕，系統將會自動記錄你觀看課程內容的時間
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                <div class="flex items-center justify-center gap-2 px-2 py-4">
                    <button
                        v-for="slide in onboardingSlides"
                        :key="slide.id"
                        type="button"
                        class="h-2.5 rounded-full transition-all"
                        :class="
                            onboardingSlides[currentSlide]?.id === slide.id
                                ? 'w-7 bg-warm-800 dark:bg-warm-400'
                                : 'w-2.5 bg-warm-300 dark:bg-zinc-700'
                        "
                        @click="currentSlide = onboardingSlides.indexOf(slide)"
                    >
                        <span class="sr-only">切換至 {{ slide.title }}</span>
                    </button>
                </div>

                <p
                    v-if="errorMessage"
                    class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
                >
                    {{ errorMessage }}
                </p>

                <div class="mt-5 flex items-center gap-3 px-2 pb-2">
                    <button
                        type="button"
                        class="inline-flex h-12 items-center justify-center rounded-2xl border border-warm-200 px-5 text-sm font-medium text-warm-800 transition hover:bg-warm-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        :disabled="currentSlide === 0 || isSavingOnboarding"
                        @click="goToPreviousSlide"
                    >
                        上一頁
                    </button>
                    <button
                        type="button"
                        class="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-warm-800 px-5 text-sm font-semibold text-white transition hover:bg-warm-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-warm-600 dark:hover:bg-warm-500"
                        :disabled="isSavingOnboarding"
                        @click="handleContinue"
                    >
                        {{
                            isSavingOnboarding
                                ? '處理中...'
                                : isLastSlide
                                  ? '開始使用'
                                  : '繼續'
                        }}
                    </button>
                </div>
            </div>

            <div
                v-else-if="errorMessage"
                class="px-6 py-10 text-center sm:px-8"
            >
                <h1
                    class="text-lg font-semibold tracking-tight text-warm-900 dark:text-zinc-100"
                >
                    登入失敗
                </h1>
                <p class="mt-2 text-sm text-warm-700 dark:text-zinc-300">
                    {{ errorMessage || '啟動驗證失敗，請稍後再試。' }}
                </p>

                <button
                    type="button"
                    class="mt-5 w-full rounded-xl bg-warm-700 px-4 py-2.5 text-sm font-medium text-warm-50 transition hover:bg-warm-800"
                    @click="bootstrapSession"
                >
                    重試
                </button>
            </div>

            <div v-else class="px-6 py-10 text-center sm:px-8">
                <h1
                    class="text-lg font-semibold tracking-tight text-warm-900 dark:text-zinc-100"
                >
                    啟動驗證中
                </h1>
                <p class="mt-2 text-sm text-warm-700 dark:text-zinc-300">
                    請稍後
                </p>
            </div>
        </div>
    </div>
</template>
