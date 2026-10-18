import type { AccountOperationResult, AccountViewModel } from '@altuu/core';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { useServiceRuntime } from '../../services/AppServicesProvider';
import { queryKeys } from '../../services/queryKeys';
import {
    useClientConfigStore,
    useSessionExpiryStore,
} from '../../services/stores';
import { useServiceMutation } from '../../services/useServiceQuery';
import { RejectedActionError } from '../lib/actionError';

interface Credentials {
    username: string;
    password: string;
}

function unwrap(result: AccountOperationResult): AccountViewModel[] {
    if (!result.ok) {
        throw new RejectedActionError(result.message);
    }

    return result.accounts;
}

/** Signs in with a HUNGU account (legacy `/login`), then refreshes app state. */
export function useLogin() {
    const runtime = useServiceRuntime();

    return useServiceMutation<void, Credentials>({
        op: 'auth.login',
        mutationFn: async (credentials, services) => {
            const outcome = await services.auth.login(credentials);

            if (!outcome.ok) {
                throw new RejectedActionError(outcome.message, outcome.raw);
            }

            await runtime.resetForAccountChange();
        },
    });
}

/** Adds another account to this device and refreshes app state. */
export function useAddAccount() {
    const runtime = useServiceRuntime();
    const queryClient = useQueryClient();

    return useServiceMutation<AccountViewModel[], Credentials>({
        op: 'accounts.add',
        mutationFn: async (credentials, services) => {
            const accounts = unwrap(await services.account.add(credentials));
            queryClient.setQueryData(queryKeys.accounts, accounts);
            await runtime.resetForAccountChange();

            return accounts;
        },
    });
}

/**
 * Re-login of an account whose session died. Resolves with the path to go
 * back to (the page the session expired on, or the course list).
 */
export function useReauthenticate(accountId: number) {
    const runtime = useServiceRuntime();
    const queryClient = useQueryClient();

    return useServiceMutation<string, string>({
        op: 'accounts.reauth',
        mutationFn: async (password, services) => {
            const accounts = unwrap(
                await services.account.reauthenticate(accountId, password),
            );
            queryClient.setQueryData(queryKeys.accounts, accounts);
            await runtime.resetForAccountChange();

            const { returnTo, setReturnTo } = useSessionExpiryStore.getState();
            setReturnTo(null);

            return returnTo ?? '/courses';
        },
    });
}

/** Changes (or clears, with an empty string) an account's nickname. */
export function useRenameAccount() {
    const runtime = useServiceRuntime();
    const queryClient = useQueryClient();

    return useServiceMutation<
        AccountViewModel[],
        { accountId: number; nickname: string }
    >({
        op: 'accounts.rename',
        mutationFn: async ({ accountId, nickname }, services) => {
            const wasActive = (await services.account.list()).find(
                (account) => account.id === accountId,
            )?.isActive;
            const accounts = await services.account.rename(
                accountId,
                nickname.trim() === '' ? null : nickname.trim(),
            );
            queryClient.setQueryData(queryKeys.accounts, accounts);

            if (wasActive) {
                await runtime.refreshSession();
            }

            return accounts;
        },
    });
}

/** Forgets an account; leaves for the login screen when it was the last one. */
export function useRemoveAccount() {
    const runtime = useServiceRuntime();
    const queryClient = useQueryClient();

    return useServiceMutation<AccountViewModel[], number>({
        op: 'accounts.remove',
        mutationFn: async (accountId, services) => {
            const wasActive = (await services.account.list()).find(
                (account) => account.id === accountId,
            )?.isActive;
            const accounts = await services.account.remove(accountId);
            queryClient.setQueryData(queryKeys.accounts, accounts);

            if (wasActive) {
                if (accounts.length > 0) {
                    await runtime.resetForAccountChange();
                } else {
                    await queryClient.resetQueries();
                    useClientConfigStore
                        .getState()
                        .setSession('unauthenticated');
                    router.replace('/login');
                }
            }

            return accounts;
        },
    });
}
