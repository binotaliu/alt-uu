<script setup lang="ts">
import {
    LockClosedIcon,
    EyeIcon,
    EyeSlashIcon,
    UserCircleIcon,
} from '@heroicons/vue/24/outline';
import { computed, reactive, ref } from 'vue';
import AndroidBottomControlBackground from '@/components/AndroidBottomControlBackground.vue';
import AppLayout from '@/components/AppLayout.vue';
import { refreshAppStateAfterAccountChange } from '@/composables/useAccountSwitcher';
import { useTitle } from '@/composables/useTitle';
import router from '@/router';
import { useAccountsStore } from '@/stores/accounts';
import { useSessionExpiryStore } from '@/stores/sessionExpiry';

const props = defineProps<{ accountId: string }>();

useTitle('重新登入');

const accountsStore = useAccountsStore();
const expiry = useSessionExpiryStore();

if (!accountsStore.isLoaded) {
    void accountsStore.loadAccounts();
}

const numericAccountId = computed(() => Number(props.accountId));
const account = computed(() =>
    accountsStore.accounts.find((a) => a.id === numericAccountId.value),
);

const form = reactive({
    password: '',
    processing: false,
    error: '',
});

const showPassword = ref(false);

async function submit() {
    form.processing = true;
    form.error = '';

    try {
        await accountsStore.reauthenticateAccount(
            numericAccountId.value,
            form.password,
        );
        await refreshAppStateAfterAccountChange();

        const returnTo = expiry.returnTo;
        expiry.returnTo = null;
        router.replace(returnTo ?? { name: 'courses.index' });
    } catch (error) {
        form.error =
            error instanceof Error ? error.message : '登入失敗，請稍後再試。';
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
                    class="flex w-full flex-col items-center justify-center gap-3 py-2"
                >
                    <img
                        v-if="account?.picture"
                        :src="account.picture"
                        alt=""
                        draggable="false"
                        class="size-16 rounded-full object-cover select-none [-webkit-touch-callout:none]"
                    />
                    <UserCircleIcon
                        v-else
                        class="size-16 text-theme-700 dark:text-zinc-500"
                    />
                    <span class="text-lg font-semibold text-theme-800">{{
                        account?.nickname ?? account?.username ?? '此帳號'
                    }}</span>
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
                            重新登入
                        </h2>
                        <p
                            class="mt-1 text-sm text-theme-700 dark:text-zinc-300"
                        >
                            此帳號的登入已失效，請重新輸入密碼以繼續使用。
                        </p>

                        <form class="mt-6 space-y-4" @submit.prevent="submit">
                            <label class="block">
                                <span
                                    class="mb-1 block text-sm font-medium text-theme-800 dark:text-zinc-100"
                                    >密碼</span
                                >
                                <div
                                    class="flex items-center rounded-xl border bg-white px-3 dark:bg-zinc-700 dark:text-zinc-100"
                                    :class="
                                        form.error
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
                                        autofocus
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
                                <p
                                    v-if="form.error"
                                    class="mt-1 text-sm text-rose-600 dark:text-rose-400"
                                >
                                    {{ form.error }}
                                </p>
                            </label>

                            <button
                                type="submit"
                                :disabled="form.processing"
                                class="w-full rounded-xl bg-theme-700 px-4 py-3 font-medium text-theme-50 transition hover:bg-theme-800 disabled:opacity-50"
                            >
                                {{ form.processing ? '登入中...' : '登入' }}
                            </button>
                        </form>
                    </section>
                </div>
            </div>
        </div>

        <AndroidBottomControlBackground />
    </AppLayout>
</template>
