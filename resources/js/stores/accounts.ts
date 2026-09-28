import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiFetch } from '@/composables/useApi';
import type { AccountProfile } from '@/types';

interface AccountActionResponse {
    ok: boolean;
    message: string;
    accounts: AccountProfile[];
}

export const useAccountsStore = defineStore('accounts', () => {
    const accounts = ref<AccountProfile[]>([]);
    const isLoaded = ref<boolean>(false);

    let inflight: Promise<void> | null = null;

    async function loadAccounts(force = false): Promise<void> {
        if (!force && isLoaded.value) {
            return;
        }

        if (!force && inflight) {
            return inflight;
        }

        inflight = (async () => {
            try {
                accounts.value =
                    await apiFetch<AccountProfile[]>('/api/accounts');
                isLoaded.value = true;
            } finally {
                inflight = null;
            }
        })();

        return inflight;
    }

    // Failures reject with an Error carrying the backend's Chinese message
    // (see apiFetch's handleErrorResponse) — callers should catch and display it.
    async function addAccount(
        username: string,
        password: string,
    ): Promise<void> {
        const result = await apiFetch<AccountActionResponse>('/api/accounts', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });

        accounts.value = result.accounts;
    }

    async function switchAccount(accountId: number): Promise<void> {
        const result = await apiFetch<AccountActionResponse>(
            `/api/accounts/${accountId}/switch`,
            { method: 'POST' },
        );

        accounts.value = result.accounts;
    }

    async function reauthenticateAccount(
        accountId: number,
        password: string,
    ): Promise<void> {
        const result = await apiFetch<AccountActionResponse>(
            `/api/accounts/${accountId}/reauthenticate`,
            { method: 'POST', body: JSON.stringify({ password }) },
        );

        accounts.value = result.accounts;
    }

    async function removeAccount(accountId: number): Promise<void> {
        accounts.value = await apiFetch<AccountProfile[]>(
            `/api/accounts/${accountId}`,
            { method: 'DELETE' },
        );
    }

    // Pass an empty string / null to clear the nickname back to the default.
    async function renameAccount(
        accountId: number,
        nickname: string | null,
    ): Promise<void> {
        accounts.value = await apiFetch<AccountProfile[]>(
            `/api/accounts/${accountId}/nickname`,
            {
                method: 'PATCH',
                body: JSON.stringify({ nickname }),
            },
        );
    }

    function reset(): void {
        accounts.value = [];
        isLoaded.value = false;
        inflight = null;
    }

    return {
        accounts,
        isLoaded,
        loadAccounts,
        addAccount,
        switchAccount,
        reauthenticateAccount,
        removeAccount,
        renameAccount,
        reset,
    };
});
