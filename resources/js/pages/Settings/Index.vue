<script setup lang="ts">
import {
    AcademicCapIcon,
    EnvelopeIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
    SparklesIcon,
    CodeBracketIcon,
} from '@heroicons/vue/24/outline';
import { ref, onMounted } from 'vue';
import { Browser } from '#nativephp';
import AndroidBottomControlBackground from '@/components/AndroidBottomControlBackground.vue';
import AppLayout from '@/components/AppLayout.vue';
import BackButton from '@/components/BackButton.vue';
import { apiFetch } from '@/composables/useApi';
import { useTitle } from '@/composables/useTitle';
import router from '@/router';
import { useAppConfigStore } from '@/stores/appConfig';

useTitle('設定');

const configStore = useAppConfigStore();

const logoutProcessing = ref(false);

async function logout() {
    logoutProcessing.value = true;

    try {
        await apiFetch('/logout', { method: 'POST' });
        router.replace({ name: 'login' });
    } catch {
        logoutProcessing.value = false;
    }
}

// Appearance preference
const appearance = ref<'system' | 'light' | 'dark'>('system');
const isSavingAppearance = ref(false);
const nouToolsIntegrationEnabled = ref<boolean>(false);
const isSavingNouToolsIntegration = ref(false);
const screenReaderEnhancedSupportEnabled = ref<boolean>(false);
const isSavingScreenReaderEnhancedSupport = ref(false);

function applyAppearanceToDocument(value: 'system' | 'light' | 'dark') {
    if (value === 'dark') {
        document.documentElement.classList.add('dark');
    } else if (value === 'light') {
        document.documentElement.classList.remove('dark');
    } else {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }

    // Keep global preference in sync for focus/visibility handlers.
    window.appearance = value;
}

onMounted(async () => {
    await configStore.loadConfig();
    appearance.value =
        (configStore.appearance as 'system' | 'light' | 'dark') ?? 'system';
    nouToolsIntegrationEnabled.value =
        configStore.nouToolsIntegrationEnabled ?? false;
    screenReaderEnhancedSupportEnabled.value =
        configStore.screenReaderEnhancedSupportEnabled ?? false;

    try {
        const [appearanceRes, nouToolsRes, screenReaderRes] = await Promise.all(
            [
                fetch('/api/preferences/appearance'),
                fetch('/api/preferences/nou-tools'),
                fetch('/api/preferences/screen-reader-enhanced-support'),
            ],
        );

        const appearanceData = await appearanceRes.json();

        if (appearanceData.appearance) {
            appearance.value = appearanceData.appearance;
        }

        const nouToolsData = await nouToolsRes.json();

        if (typeof nouToolsData.enabled === 'boolean') {
            nouToolsIntegrationEnabled.value = nouToolsData.enabled;
        }

        const screenReaderData = await screenReaderRes.json();

        if (typeof screenReaderData.enabled === 'boolean') {
            screenReaderEnhancedSupportEnabled.value = screenReaderData.enabled;
        }
    } catch {
        // keep default
    }

    applyAppearanceToDocument(appearance.value);
});

async function setAppearance(value: 'system' | 'light' | 'dark') {
    appearance.value = value;
    isSavingAppearance.value = true;

    try {
        await fetch('/api/preferences/appearance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN':
                    (
                        document.querySelector(
                            'meta[name="csrf-token"]',
                        ) as HTMLMetaElement | null
                    )?.content ?? '',
            },
            body: JSON.stringify({ appearance: value }),
        });

        configStore.appearance = value;

        // Apply immediately without reload.
        applyAppearanceToDocument(value);
    } finally {
        isSavingAppearance.value = false;
    }
}

async function setNouToolsIntegrationEnabled(enabled: boolean) {
    nouToolsIntegrationEnabled.value = enabled;
    isSavingNouToolsIntegration.value = true;

    try {
        await fetch('/api/preferences/nou-tools', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN':
                    (
                        document.querySelector(
                            'meta[name="csrf-token"]',
                        ) as HTMLMetaElement | null
                    )?.content ?? '',
            },
            body: JSON.stringify({ enabled }),
        });

        configStore.nouToolsIntegrationEnabled = enabled;
    } finally {
        isSavingNouToolsIntegration.value = false;
    }
}

async function setScreenReaderEnhancedSupportEnabled(enabled: boolean) {
    screenReaderEnhancedSupportEnabled.value = enabled;
    isSavingScreenReaderEnhancedSupport.value = true;

    try {
        await fetch('/api/preferences/screen-reader-enhanced-support', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN':
                    (
                        document.querySelector(
                            'meta[name="csrf-token"]',
                        ) as HTMLMetaElement | null
                    )?.content ?? '',
            },
            body: JSON.stringify({ enabled }),
        });

        configStore.screenReaderEnhancedSupportEnabled = enabled;
    } finally {
        isSavingScreenReaderEnhancedSupport.value = false;
    }
}

async function openInApp(url: string) {
    try {
        const handled = await Browser.inApp(url);

        if (!handled) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    } catch {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

const appearanceOptions = [
    { value: 'system', label: '自動' },
    { value: 'light', label: '淺色' },
    { value: 'dark', label: '深色' },
] as const;
</script>

<template>
    <AppLayout>
        <div
            class="sticky top-0 z-200 w-full bg-warm-100/80 py-1.5 pt-(--inset-top,4rem) pr-(--inset-right,0px) pl-[max(var(--inset-left,0px),var(--corner-inset-left,0px),1rem)] backdrop-blur-xs [view-transition-name:page-header] dark:bg-zinc-950/80"
        >
            <div
                class="flex items-center justify-between gap-2 pt-0.5 text-warm-900 dark:text-zinc-100"
            >
                <div class="flex items-center gap-2">
                    <BackButton
                        :href="configStore.isLoggedIn ? '/courses' : '/login'"
                    />

                    <h2
                        class="text-lg font-semibold [view-transition-name:page-header-title]"
                    >
                        設定
                    </h2>
                </div>
            </div>
        </div>

        <div class="mx-auto mt-6 w-full max-w-4xl space-y-4 px-4 pb-24">
            <div
                class="mb-8 flex w-full flex-col items-center justify-center gap-4 py-2"
            >
                <div class="flex flex-col items-center md:flex-row md:gap-4">
                    <AcademicCapIcon class="size-16 text-warm-700" />
                    <span class="text-2xl font-extrabold text-warm-700"
                        >Alt UU</span
                    >
                </div>
                <span
                    class="font-semibold text-warm-700"
                    v-if="configStore.appVersion === 'DEBUG'"
                >
                    {{ configStore.appVersion }} ({{
                        configStore.appVersionCode
                    }})
                </span>
                <span class="font-semibold text-warm-700" v-else>
                    v{{ configStore.appVersion }} ({{
                        configStore.appVersionCode
                    }})
                </span>
            </div>

            <section
                class="rounded-xl border border-warm-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <h3
                    class="text-sm font-semibold text-warm-900 dark:text-zinc-100"
                >
                    外觀
                </h3>
                <p class="mt-1 text-xs text-warm-600 dark:text-zinc-400">
                    選擇深色或淺色模式，或依照系統設定自動切換。
                </p>
                <div
                    class="mt-3 flex rounded-xl border border-warm-200 bg-warm-50 p-1 dark:border-zinc-700 dark:bg-zinc-800"
                >
                    <button
                        v-for="option in appearanceOptions"
                        :key="option.value"
                        type="button"
                        class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
                        :class="
                            appearance === option.value
                                ? 'bg-white text-warm-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                                : 'text-warm-600 hover:text-warm-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                        "
                        :disabled="isSavingAppearance"
                        @click="setAppearance(option.value)"
                    >
                        {{ option.label }}
                    </button>
                </div>
            </section>

            <section
                class="rounded-xl border border-warm-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <h3
                            class="text-sm font-semibold text-warm-900 dark:text-zinc-100"
                        >
                            開啟 NOU 小幫手整合
                        </h3>
                        <p
                            class="mt-1 text-xs leading-relaxed text-warm-600 dark:text-zinc-400"
                        >
                            開啟此選項以讓 Alt UU 從 NOU
                            小幫手取得課程資訊與視訊面授資訊。部分詮釋資料可能會傳送給
                            NOU 小幫手以提供此功能。
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
                        :disabled="isSavingNouToolsIntegration"
                        @click="
                            setNouToolsIntegrationEnabled(
                                !nouToolsIntegrationEnabled,
                            )
                        "
                    >
                        <span class="sr-only">切換 NOU 小幫手整合</span>
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
            </section>

            <section
                class="rounded-xl border border-warm-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <h3
                            class="text-sm font-semibold text-warm-900 dark:text-zinc-100"
                        >
                            加強螢幕閱讀器支援
                        </h3>
                        <p
                            class="mt-1 text-xs leading-relaxed text-warm-600 dark:text-zinc-400"
                        >
                            若您使用螢幕閱讀器，如 VoiceOver、TalkBack、NVDA 或
                            JAWS，開啟此選項可讓 Alt UU
                            在教材頁中使用對螢幕閱讀器較友善的播放器。
                        </p>
                    </div>

                    <button
                        type="button"
                        class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition"
                        :class="
                            screenReaderEnhancedSupportEnabled
                                ? 'bg-warm-700 dark:bg-warm-600'
                                : 'bg-warm-300 dark:bg-zinc-600'
                        "
                        :disabled="isSavingScreenReaderEnhancedSupport"
                        @click="
                            setScreenReaderEnhancedSupportEnabled(
                                !screenReaderEnhancedSupportEnabled,
                            )
                        "
                    >
                        <span class="sr-only">切換增強螢幕閱讀器支援</span>
                        <span
                            class="inline-block size-5 transform rounded-full bg-white shadow transition"
                            :class="
                                screenReaderEnhancedSupportEnabled
                                    ? 'translate-x-6'
                                    : 'translate-x-1'
                            "
                        />
                    </button>
                </div>
            </section>

            <section
                class="rounded-xl border border-warm-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <h3
                    class="text-sm font-semibold text-warm-900 dark:text-zinc-100"
                >
                    聯絡資訊與政策
                </h3>
                <div class="mt-2 grid gap-2">
                    <a
                        class="inline-flex items-center justify-center gap-2 rounded-lg border border-warm-300 bg-warm-50 px-3 py-2 text-sm font-medium text-warm-800 hover:border-warm-400 hover:bg-warm-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                        href="mailto:alt-uu-contact@binota.org"
                    >
                        <EnvelopeIcon
                            class="size-4 text-warm-700 dark:text-zinc-200"
                        />
                        <span class="w-30 text-center"> 聯絡本 App 作者 </span>
                    </a>
                    <button
                        type="button"
                        class="inline-flex items-center justify-center gap-2 rounded-lg border border-warm-300 bg-warm-50 px-3 py-2 text-sm font-medium text-warm-800 hover:border-warm-400 hover:bg-warm-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                        @click="
                            openInApp(
                                'https://alt-uu-statics.wcsvdzeimhwq.workers.dev/usage-policy',
                            )
                        "
                    >
                        <DocumentTextIcon
                            class="size-4 text-warm-700 dark:text-zinc-200"
                        />
                        <span class="w-30 text-center"> 使用條款 </span>
                    </button>
                    <button
                        type="button"
                        class="inline-flex items-center justify-center gap-2 rounded-lg border border-warm-300 bg-warm-50 px-3 py-2 text-sm font-medium text-warm-800 hover:border-warm-400 hover:bg-warm-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                        @click="
                            openInApp(
                                'https://alt-uu-statics.wcsvdzeimhwq.workers.dev/privacy-policy',
                            )
                        "
                    >
                        <ShieldCheckIcon
                            class="size-4 text-warm-700 dark:text-zinc-200"
                        />
                        <span class="w-30 text-center"> 隱私權政策 </span>
                    </button>
                    <button
                        type="button"
                        class="inline-flex items-center justify-center gap-2 rounded-lg border border-warm-300 bg-warm-50 px-3 py-2 text-sm font-medium text-warm-800 hover:border-warm-400 hover:bg-warm-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                        @click="
                            openInApp(
                                'https://alt-uu-statics.wcsvdzeimhwq.workers.dev/changelog',
                            )
                        "
                    >
                        <SparklesIcon
                            class="size-4 text-warm-700 dark:text-zinc-200"
                        />
                        <span class="w-30 text-center"> 版本更新說明 </span>
                    </button>
                    <button
                        type="button"
                        class="inline-flex items-center justify-center gap-2 rounded-lg border border-warm-300 bg-warm-50 px-3 py-2 text-sm font-medium text-warm-800 hover:border-warm-400 hover:bg-warm-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                        @click="
                            openInApp('https://github.com/binotaliu/alt-uu')
                        "
                    >
                        <CodeBracketIcon
                            class="size-4 text-warm-700 dark:text-zinc-200"
                        />
                        <span class="w-30 text-center"> App 原始碼 </span>
                    </button>
                </div>
                <p
                    class="mt-3 text-sm leading-relaxed text-warm-700 dark:text-zinc-300"
                >
                    本程式為 AGPL-3.0-or-later
                    開放原始碼授權軟體。任何人均可自由取得原始碼、修改、編譯、再發佈，惟須維持相同授權方式。
                </p>
            </section>

            <section
                class="rounded-xl border border-warm-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <h3
                    class="text-sm font-semibold text-warm-900 dark:text-zinc-100"
                >
                    鳴謝
                </h3>
                <div
                    class="prose mt-2 text-sm leading-relaxed text-warm-700 prose-warm dark:text-zinc-300 dark:prose-zinc dark:prose-invert"
                >
                    <p>
                        Alt UU 的誕生離不開許多人的幫助，特別是 Laravel 社群與
                        Vue 社群豐富的生態，以及所有參與 Alt UU
                        公開測試的同學。<br />
                        以下是一些 Alt UU
                        使用到的開放原始碼專案與其授權。您應該可以在本專案的
                        GitHub Repository 內找到更多資訊。
                    </p>
                    <ul>
                        <li>Laravel (MIT License)</li>
                        <li>Vue (MIT License)</li>
                        <li>Vue Router (MIT License)</li>
                        <li>Tailwind CSS (MIT License)</li>
                        <li>Heroicons (MIT License)</li>
                        <li>NativePHP (MIT License)</li>
                    </ul>
                </div>
            </section>

            <section v-if="configStore.isLoggedIn">
                <button
                    type="button"
                    :disabled="logoutProcessing"
                    class="inline-flex w-full items-center justify-center rounded-xl border border-rose-500 bg-white px-4 py-2 text-base font-medium text-rose-700 transition hover:bg-rose-400 hover:text-white disabled:opacity-50 md:px-5 md:py-4 md:text-lg dark:border-rose-500 dark:bg-zinc-900 dark:text-rose-400 dark:hover:bg-rose-600 dark:hover:text-white"
                    @click="logout"
                >
                    {{ logoutProcessing ? '登出中...' : '登出' }}
                </button>
            </section>
        </div>

        <AndroidBottomControlBackground />
    </AppLayout>
</template>
