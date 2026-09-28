<script setup lang="ts">
import {
    ChevronDownIcon,
    PlusIcon,
    UserCircleIcon,
} from '@heroicons/vue/24/outline';
import { onMounted, reactive, ref } from 'vue';
import AppLayout from '@/components/AppLayout.vue';
import BackButton from '@/components/BackButton.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import RenameAccountDialog from '@/components/RenameAccountDialog.vue';
import {
    refreshAppStateAfterAccountChange,
    useAccountSwitcher,
} from '@/composables/useAccountSwitcher';
import { useTitle } from '@/composables/useTitle';
import router from '@/router';
import { useAccountsStore } from '@/stores/accounts';
import { useAppConfigStore } from '@/stores/appConfig';
import { useCourseStore } from '@/stores/courses';
import { useDiscussStore } from '@/stores/discuss';
import { useModerationStore } from '@/stores/moderation';
import { useSubscriptionStore } from '@/stores/subscription';

useTitle('切換帳號');

const configStore = useAppConfigStore();
const subscriptionStore = useSubscriptionStore();
const accountsStore = useAccountsStore();
const { switchAccount } = useAccountSwitcher();

const addAccountForm = reactive({
    visible: false,
    username: '',
    password: '',
    processing: false,
    error: '',
});

function toggleAddAccountForm(): void {
    addAccountForm.visible = !addAccountForm.visible;
    addAccountForm.username = '';
    addAccountForm.password = '';
    addAccountForm.error = '';
}

async function onAddAccount(): Promise<void> {
    addAccountForm.processing = true;
    addAccountForm.error = '';

    try {
        await accountsStore.addAccount(
            addAccountForm.username,
            addAccountForm.password,
        );
        addAccountForm.visible = false;
        addAccountForm.username = '';
        addAccountForm.password = '';
        await refreshAppStateAfterAccountChange();
    } catch (error) {
        addAccountForm.error =
            error instanceof Error
                ? error.message
                : '新增帳號失敗，請稍後再試。';
    } finally {
        addAccountForm.processing = false;
    }
}

const expandedAccountId = ref<number | null>(null);

function toggleAccountExpanded(accountId: number): void {
    expandedAccountId.value =
        expandedAccountId.value === accountId ? null : accountId;
}

const switchingAccountId = ref<number | null>(null);

async function onSwitchAccount(accountId: number): Promise<void> {
    switchingAccountId.value = accountId;

    try {
        await switchAccount(accountId);
        await router.push({ name: 'courses.index' });
        window.showFlashMessage('已切換帳號', 'success');
    } catch (error) {
        await accountsStore.loadAccounts(true);
        alert(
            error instanceof Error
                ? error.message
                : '切換帳號失敗，請稍後再試。',
        );
    } finally {
        switchingAccountId.value = null;
    }
}

const removingAccountId = ref<number | null>(null);
const accountIdPendingRemoval = ref<number | null>(null);

function onRemoveAccount(accountId: number): void {
    accountIdPendingRemoval.value = accountId;
}

async function confirmRemoveAccount(): Promise<void> {
    const accountId = accountIdPendingRemoval.value;
    accountIdPendingRemoval.value = null;

    if (accountId === null) {
        return;
    }

    removingAccountId.value = accountId;

    try {
        const wasActive = accountsStore.accounts.find(
            (account) => account.id === accountId,
        )?.isActive;

        await accountsStore.removeAccount(accountId);

        const stillLoggedIn = accountsStore.accounts.length > 0;

        if (wasActive) {
            if (stillLoggedIn) {
                await refreshAppStateAfterAccountChange();
            } else {
                configStore.reset();
                useCourseStore().reset();
                useModerationStore().reset();
                useDiscussStore().reset();
                subscriptionStore.reset();
                router.replace({ name: 'login' });
            }
        }
    } finally {
        removingAccountId.value = null;
    }
}

const renameForm = reactive({
    accountId: null as number | null,
    value: '',
    processing: false,
    error: '',
});

function onOpenRename(accountId: number, currentNickname: string | null): void {
    renameForm.accountId = accountId;
    renameForm.value = currentNickname ?? '';
    renameForm.error = '';
}

function onCancelRename(): void {
    renameForm.accountId = null;
}

async function onConfirmRename(value: string): Promise<void> {
    if (renameForm.accountId === null) {
        return;
    }

    renameForm.processing = true;
    renameForm.error = '';

    try {
        const isActiveAccount = accountsStore.accounts.find(
            (account) => account.id === renameForm.accountId,
        )?.isActive;

        await accountsStore.renameAccount(renameForm.accountId, value.trim());

        if (isActiveAccount) {
            await configStore.loadConfig(true);
        }

        renameForm.accountId = null;
    } catch (error) {
        renameForm.error =
            error instanceof Error
                ? error.message
                : '修改名稱失敗，請稍後再試。';
    } finally {
        renameForm.processing = false;
    }
}

onMounted(async () => {
    accountsStore.loadAccounts();
});
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

                    <h2 class="text-lg font-semibold">切換帳號</h2>
                </div>
            </div>
        </div>

        <div
            class="mx-auto w-full max-w-2xl space-y-4 px-4 pb-[calc(var(--inset-bottom,0px)+2rem)]"
        >
            <div
                class="rounded-xl border border-theme-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
                <h3
                    class="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                >
                    帳號
                </h3>

                <ul class="mt-3 space-y-2">
                    <li
                        v-for="account in accountsStore.accounts"
                        :key="account.id"
                        class="rounded-lg border border-theme-200 dark:border-zinc-700"
                        :class="
                            account.isActive
                                ? 'bg-amber-50/50 dark:bg-amber-500/5'
                                : ''
                        "
                    >
                        <button
                            type="button"
                            class="flex w-full items-center gap-3 p-3 text-left"
                            @click="toggleAccountExpanded(account.id)"
                        >
                            <img
                                v-if="account.picture"
                                :src="account.picture"
                                alt=""
                                draggable="false"
                                class="size-10 shrink-0 rounded-full object-cover select-none [-webkit-touch-callout:none]"
                            />
                            <UserCircleIcon
                                v-else
                                class="size-10 shrink-0 text-theme-700 dark:text-zinc-500"
                            />

                            <div class="min-w-0 flex-1">
                                <p
                                    class="truncate text-sm font-semibold text-theme-900 dark:text-zinc-100"
                                >
                                    {{ account.nickname || account.username }}
                                </p>
                                <p
                                    class="truncate text-xs text-theme-700 dark:text-zinc-400"
                                >
                                    {{
                                        account.nickname
                                            ? `${account.username} · ${account.displayName}`
                                            : account.displayName
                                    }}
                                </p>
                            </div>

                            <span
                                v-if="account.isActive"
                                class="shrink-0 rounded-full bg-amber-700 px-2 py-0.5 text-xs font-semibold text-white"
                            >
                                目前帳號
                            </span>

                            <ChevronDownIcon
                                class="size-4 shrink-0 text-theme-700 transition-transform dark:text-zinc-500"
                                :class="
                                    expandedAccountId === account.id
                                        ? 'rotate-180'
                                        : ''
                                "
                            />
                        </button>

                        <div
                            v-if="expandedAccountId === account.id"
                            class="flex flex-col gap-2 border-t border-theme-200 p-3 dark:border-zinc-700"
                        >
                            <button
                                v-if="!account.isActive"
                                type="button"
                                :disabled="switchingAccountId === account.id"
                                class="rounded-lg border border-theme-300 px-3 py-2 text-sm font-medium text-theme-700 transition hover:bg-theme-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                @click="onSwitchAccount(account.id)"
                            >
                                {{
                                    switchingAccountId === account.id
                                        ? '切換中…'
                                        : '切換帳號'
                                }}
                            </button>

                            <button
                                type="button"
                                class="rounded-lg border border-theme-300 px-3 py-2 text-sm font-medium text-theme-700 transition hover:bg-theme-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                @click="
                                    onOpenRename(account.id, account.nickname)
                                "
                            >
                                修改名稱
                            </button>

                            <button
                                type="button"
                                :disabled="removingAccountId === account.id"
                                class="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
                                @click="onRemoveAccount(account.id)"
                            >
                                登出此帳號
                            </button>
                        </div>
                    </li>
                </ul>

                <button
                    v-if="!addAccountForm.visible"
                    type="button"
                    class="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-theme-300 px-3 py-2 text-sm font-medium text-theme-700 transition hover:bg-theme-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    @click="toggleAddAccountForm"
                >
                    <PlusIcon class="size-4" />
                    新增帳號
                </button>

                <form
                    v-else
                    class="mt-3 space-y-2 rounded-lg border border-theme-200 p-3 dark:border-zinc-700"
                    @submit.prevent="onAddAccount"
                >
                    <input
                        v-model="addAccountForm.username"
                        type="text"
                        placeholder="請輸入學號或帳號"
                        autocomplete="username"
                        class="w-full rounded-lg border border-theme-300 bg-white px-3 py-2 text-sm text-theme-900 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    <input
                        v-model="addAccountForm.password"
                        type="password"
                        placeholder="請輸入密碼"
                        autocomplete="current-password"
                        class="w-full rounded-lg border border-theme-300 bg-white px-3 py-2 text-sm text-theme-900 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    <p
                        v-if="addAccountForm.error"
                        class="text-xs text-rose-600 dark:text-rose-400"
                    >
                        {{ addAccountForm.error }}
                    </p>
                    <div class="flex gap-2">
                        <button
                            type="submit"
                            :disabled="addAccountForm.processing"
                            class="flex-1 rounded-lg bg-theme-700 px-3 py-2 text-sm font-medium text-theme-50 transition hover:bg-theme-800 disabled:opacity-50"
                        >
                            {{
                                addAccountForm.processing
                                    ? '新增中…'
                                    : '確認新增'
                            }}
                        </button>
                        <button
                            type="button"
                            class="rounded-lg border border-theme-300 px-3 py-2 text-sm font-medium text-theme-700 dark:border-zinc-600 dark:text-zinc-300"
                            @click="toggleAddAccountForm"
                        >
                            取消
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <ConfirmDialog
            :is-open="accountIdPendingRemoval !== null"
            title="移除帳號"
            message="確定要移除這個帳號嗎？移除後將登出該帳號的所有裝置端資料。"
            confirm-label="移除"
            danger
            @confirm="confirmRemoveAccount"
            @cancel="accountIdPendingRemoval = null"
        />

        <RenameAccountDialog
            :is-open="renameForm.accountId !== null"
            :initial-value="renameForm.value"
            :processing="renameForm.processing"
            :error="renameForm.error"
            @confirm="onConfirmRename"
            @cancel="onCancelRename"
        />
    </AppLayout>
</template>
