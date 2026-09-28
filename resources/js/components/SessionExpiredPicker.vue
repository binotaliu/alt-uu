<script setup lang="ts">
import { computed, ref } from 'vue';
import AccountListItem from '@/components/AccountListItem.vue';
import { useAccountSwitcher } from '@/composables/useAccountSwitcher';
import router from '@/router';
import { useAccountsStore } from '@/stores/accounts';
import { useSessionExpiryStore } from '@/stores/sessionExpiry';

const accountsStore = useAccountsStore();
const expiry = useSessionExpiryStore();
const { switchAccount } = useAccountSwitcher();

const switchingAccountId = ref<number | null>(null);

const failedAccount = computed(() =>
    accountsStore.accounts.find(
        (account) => account.id === expiry.failedAccountId,
    ),
);

const otherAccounts = computed(() =>
    accountsStore.accounts.filter(
        (account) => account.id !== expiry.failedAccountId,
    ),
);

const failedAccountName = computed(
    () =>
        failedAccount.value?.nickname ??
        failedAccount.value?.displayName ??
        failedAccount.value?.username ??
        '目前帳號',
);

function goToReauth(accountId: number): void {
    expiry.returnTo ??= router.currentRoute.value.fullPath;
    expiry.closePicker();
    router.push({ name: 'reauth', params: { accountId: String(accountId) } });
}

async function onSelectAccount(accountId: number): Promise<void> {
    if (switchingAccountId.value !== null) {
        return;
    }

    switchingAccountId.value = accountId;

    try {
        await switchAccount(accountId);
        expiry.closePicker();
        window.showFlashMessage('已切換帳號', 'success');
    } catch (error) {
        const message =
            error instanceof Error ? error.message : '切換帳號失敗。';

        // Matches the "此帳號的登入已失效，請重新輸入密碼。" message returned by
        // SwitchAccount when the target account's own session is also dead —
        // chain into the same re-login screen instead of dead-ending here.
        if (message.includes('已失效')) {
            goToReauth(accountId);
        } else {
            window.showFlashMessage(message, 'error');
        }
    } finally {
        switchingAccountId.value = null;
    }
}
</script>

<template>
    <Teleport to="body">
        <div
            v-if="expiry.pickerOpen"
            class="fixed inset-0 z-500 flex items-end justify-center bg-black/40 p-4 pb-[max(var(--inset-bottom,0px),1rem)] backdrop-blur-xs md:items-center"
            @click.self="expiry.closePicker()"
        >
            <div
                class="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
            >
                <div class="px-5 py-4">
                    <h3
                        class="text-lg font-semibold text-theme-900 dark:text-zinc-100"
                    >
                        登入已失效
                    </h3>
                    <p class="mt-1 text-sm text-theme-700 dark:text-zinc-400">
                        「{{
                            failedAccountName
                        }}」需要重新登入，您可以切換到其他帳號繼續使用。
                    </p>
                </div>

                <ul
                    class="max-h-80 overflow-y-auto border-t border-theme-200 dark:border-zinc-700"
                >
                    <li v-for="account in otherAccounts" :key="account.id">
                        <AccountListItem
                            :account="account"
                            :disabled="switchingAccountId === account.id"
                            @select="onSelectAccount(account.id)"
                        >
                            <template #trailing>
                                <span
                                    v-if="switchingAccountId === account.id"
                                    class="shrink-0 text-xs text-theme-700 dark:text-zinc-400"
                                >
                                    切換中…
                                </span>
                            </template>
                        </AccountListItem>
                    </li>
                </ul>

                <div
                    v-if="expiry.failedAccountId !== null"
                    class="border-t border-theme-200 px-5 py-3 dark:border-zinc-700"
                >
                    <button
                        type="button"
                        class="block w-full text-center text-sm font-medium text-theme-700 dark:text-zinc-300"
                        @click="goToReauth(expiry.failedAccountId)"
                    >
                        重新登入「{{ failedAccountName }}」
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>
