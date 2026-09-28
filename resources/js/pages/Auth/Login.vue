<script setup lang="ts">
import {
    AcademicCapIcon,
    UserIcon,
    LockClosedIcon,
    EyeIcon,
    EyeSlashIcon,
    Cog6ToothIcon,
} from '@heroicons/vue/24/outline';
import { ref, reactive } from 'vue';
import { Browser } from '#nativephp';
import AndroidBottomControlBackground from '@/components/AndroidBottomControlBackground.vue';
import AppLayout from '@/components/AppLayout.vue';
import { refreshAppStateAfterAccountChange } from '@/composables/useAccountSwitcher';
import { apiFetch } from '@/composables/useApi';
import type { ApiError } from '@/composables/useApi';
import { useTitle } from '@/composables/useTitle';
import router from '@/router';

useTitle('登入');

const form = reactive({
    username: '',
    password: '',
    processing: false,
    error: '',
    errors: { username: '', password: '' } as Record<string, string>,
});

const rawResponse = ref<string | null>(null);
const showPassword = ref(false);

async function openPolicy(url: string) {
    await Browser.inApp(url);
}

async function submit() {
    form.processing = true;
    form.error = '';
    form.errors = { username: '', password: '' };
    rawResponse.value = null;

    try {
        await apiFetch<{ ok: boolean }>('/login', {
            method: 'POST',
            body: JSON.stringify({
                username: form.username,
                password: form.password,
            }),
        });

        await refreshAppStateAfterAccountChange();

        router.replace({ name: 'courses.index' });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : '登入失敗，請稍後再試。';
        form.error = message;
        form.errors.username = message;
        form.errors.password = message;

        const raw = (error as ApiError | undefined)?.raw;
        rawResponse.value =
            raw !== undefined ? JSON.stringify(raw, null, 2) : null;
    } finally {
        form.processing = false;
    }
}
</script>

<template>
    <AppLayout>
        <div
            class="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_right,oklch(0.98_0.03_40),white_45%,oklch(0.96_0.02_40))] font-sans antialiased dark:bg-zinc-950 dark:bg-none"
        >
            <div
                class="flex flex-col gap-6 overflow-hidden pt-[max(var(--inset-top),4rem)] pr-[max(var(--inset-right),1rem)] pl-[max(var(--inset-left),1rem)] md:flex-row"
            >
                <div
                    class="flex w-full flex-col items-center justify-center py-2 md:flex-row md:gap-4"
                >
                    <AcademicCapIcon class="size-16 text-theme-700" />
                    <span class="text-2xl font-extrabold text-theme-700"
                        >Alt UU</span
                    >
                </div>

                <div
                    class="mx-auto grid w-full max-w-5xl gap-6 rounded-3xl border border-theme-200 bg-white/40 p-6 shadow-2xl shadow-theme-200/40 backdrop-blur md:p-10 dark:border-zinc-700 dark:bg-zinc-900/80 dark:shadow-zinc-900/40"
                >
                    <section
                        class="rounded-2xl border border-theme-200 bg-theme-50 p-6 md:p-8 dark:border-zinc-700 dark:bg-zinc-800"
                    >
                        <h2
                            class="text-xl font-semibold text-theme-900 dark:text-zinc-100"
                        >
                            登入 NOU UU 平台
                        </h2>
                        <p
                            class="mt-1 text-sm text-theme-700 dark:text-zinc-300"
                        >
                            請輸入 NOU UU
                            平台之登入資訊。所有資訊都將在您的裝置上直接與 NOU
                            UU 平台建立安全通訊，不會傳送至其他伺服器。
                        </p>

                        <form class="mt-6 space-y-4" @submit.prevent="submit">
                            <label class="block">
                                <span
                                    class="mb-1 block text-sm font-medium text-theme-800 dark:text-zinc-100"
                                    >帳號</span
                                >
                                <div
                                    class="flex items-center rounded-xl border bg-white px-3 dark:bg-zinc-700 dark:text-zinc-100"
                                    :class="
                                        form.errors.username
                                            ? 'border-rose-400'
                                            : 'border-theme-300 dark:border-zinc-600'
                                    "
                                >
                                    <UserIcon
                                        class="h-5 w-5 text-theme-700 dark:text-zinc-400"
                                    />
                                    <input
                                        v-model="form.username"
                                        type="text"
                                        class="w-full border-0 bg-transparent px-2 py-3 text-theme-900 focus:outline-none dark:text-zinc-100"
                                        placeholder="請輸入學號或帳號"
                                        autocomplete="username"
                                    />
                                </div>
                            </label>

                            <label class="block">
                                <span
                                    class="mb-1 block text-sm font-medium text-theme-800 dark:text-zinc-100"
                                    >密碼</span
                                >
                                <div
                                    class="flex items-center rounded-xl border bg-white px-3 dark:bg-zinc-700 dark:text-zinc-100"
                                    :class="
                                        form.errors.password
                                            ? 'border-rose-400'
                                            : 'border-theme-300 dark:border-zinc-600'
                                    "
                                >
                                    <LockClosedIcon
                                        class="h-5 w-5 text-theme-700 dark:text-zinc-400"
                                    />
                                    <input
                                        v-model="form.password"
                                        :type="
                                            showPassword ? 'text' : 'password'
                                        "
                                        class="w-full border-0 bg-transparent px-2 py-3 text-theme-900 focus:outline-none dark:text-zinc-100"
                                        placeholder="請輸入密碼"
                                        autocomplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        @click="showPassword = !showPassword"
                                        class="ml-2 rounded p-1 text-theme-700 hover:text-theme-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                                        aria-label="Toggle password visibility"
                                    >
                                        <EyeIcon
                                            v-if="!showPassword"
                                            class="h-5 w-5"
                                        />
                                        <EyeSlashIcon v-else class="h-5 w-5" />
                                    </button>
                                </div>
                            </label>

                            <p
                                v-if="form.error"
                                class="mt-1 text-sm text-rose-600 dark:text-rose-400"
                            >
                                {{ form.error }}
                            </p>

                            <button
                                type="submit"
                                :disabled="form.processing"
                                class="w-full rounded-xl bg-theme-700 px-4 py-3 font-medium text-theme-50 transition hover:bg-theme-800 disabled:opacity-50"
                            >
                                {{ form.processing ? '登入中...' : '登入' }}
                            </button>

                            <details v-if="rawResponse" class="mt-2 text-xs">
                                <summary
                                    class="cursor-pointer text-theme-700 select-none dark:text-zinc-400"
                                >
                                    若登入持續失敗，可展開檢視伺服器回應內容
                                </summary>
                                <pre
                                    class="mt-2 overflow-x-auto rounded-lg border border-theme-200 bg-theme-50 p-2 whitespace-pre-wrap text-theme-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                                    >{{ rawResponse }}</pre
                                >
                            </details>
                        </form>

                        <div
                            class="mt-4 text-sm text-theme-700 dark:text-zinc-300"
                        >
                            <span class="mr-2"
                                >登入即表示您已閱讀並同意本 App 之</span
                            >《<a
                                class="underline decoration-theme-400 hover:text-theme-900 dark:decoration-zinc-400 dark:hover:text-zinc-200"
                                @click.prevent="
                                    openPolicy(
                                        'https://alt-uu-statics.wcsvdzeimhwq.workers.dev/usage-policy',
                                    )
                                "
                                href="https://alt-uu-statics.wcsvdzeimhwq.workers.dev/usage-policy"
                                target="_blank"
                                rel="noopener noreferrer"
                                >使用條款</a
                            >》<span class="mx-1">與</span>《<a
                                class="underline decoration-theme-400 hover:text-theme-900 dark:decoration-zinc-400 dark:hover:text-zinc-200"
                                @click.prevent="
                                    openPolicy(
                                        'https://alt-uu-statics.wcsvdzeimhwq.workers.dev/privacy-policy',
                                    )
                                "
                                href="https://alt-uu-statics.wcsvdzeimhwq.workers.dev/privacy-policy"
                                target="_blank"
                                rel="noopener noreferrer"
                                >隱私權政策</a
                            >》
                        </div>
                    </section>

                    <div class="mx-auto mt-4 w-full max-w-5xl text-center">
                        <router-link
                            to="/settings"
                            class="inline-flex items-center gap-1 text-sm font-medium text-theme-700 underline decoration-theme-400 underline-offset-4 transition hover:text-theme-900 dark:text-zinc-300 dark:decoration-zinc-400 dark:hover:text-zinc-200"
                        >
                            <Cog6ToothIcon class="h-4 w-4" />
                            設定
                        </router-link>
                    </div>
                </div>
            </div>
        </div>

        <AndroidBottomControlBackground />
    </AppLayout>
</template>
