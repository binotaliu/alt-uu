import type {
  AccountOperationResult,
  AccountViewModel,
  AppPreferences,
  AppPreferencesUpdate,
  EntitlementViewModel,
  SessionProfileViewModel,
  AppStatus,
} from '@altuu/core';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useServiceRuntime } from './AppServicesProvider';
import { queryKeys } from './queryKeys';
import { useClientConfigStore } from './stores';
import { useServiceMutation, useServiceQuery } from './useServiceQuery';

/** Accounts of this device (local read, never hits the network). */
export function useAccounts() {
  return useServiceQuery<AccountViewModel[]>({
    op: 'accounts.list',
    queryKey: queryKeys.accounts,
    queryFn: (services) => services.account.list(),
    staleTime: 0,
  });
}

/** The active account's profile, from the stored HUNGU session. */
export function useSessionProfile() {
  return useServiceQuery<SessionProfileViewModel>({
    op: 'auth.profile',
    queryKey: queryKeys.sessionProfile,
    queryFn: (services) => services.auth.getSessionProfile(),
  });
}

/** Persisted preferences, mirrored in a store so they are readable synchronously. */
export function useAppPreferences(): AppPreferences {
  return useClientConfigStore((state) => state.preferences);
}

/**
 * Saves a preferences change (for example
 * `update({ appearance: 'dark' })`). Rejects with a ServiceError, e.g. the
 * Alt UU+ message when picking a paid accent colour without a subscription.
 */
export function useUpdatePreferences() {
  const runtime = useServiceRuntime();

  return useServiceMutation<AppPreferences, AppPreferencesUpdate>({
    op: 'app.preferences',
    mutationFn: (update) => runtime.updatePreferences(update),
  });
}

/** Build info and the effective preferences (about screen, material viewer flag). */
export function useAppConfig() {
  return useServiceQuery({
    op: 'app.config',
    queryKey: queryKeys.appConfig,
    queryFn: (services) => services.appConfig.get(),
  });
}

/** Update / announcement banners (best-effort: errors just hide them). */
export function useAppStatus() {
  return useServiceQuery<AppStatus>({
    op: 'app.status',
    queryKey: queryKeys.appStatus,
    queryFn: (services) => services.appStatus.get(),
    staleTime: 5 * 60_000,
  });
}

/** Locally cached Alt UU+ entitlement (no network). */
export function useCachedEntitlement() {
  return useServiceQuery<EntitlementViewModel>({
    op: 'subscription.status',
    queryKey: queryKeys.entitlement,
    queryFn: (services) => services.subscription.getCachedEntitlement(),
  });
}

/** Whether Alt UU+ is active according to the cached entitlement. */
export function useIsSubscribed(): boolean {
  return useCachedEntitlement().data?.active ?? false;
}

export interface SwitchAccountState {
  /** Resolves with the service result; `ok: false` carries the message to show. */
  switchAccount: (accountId: number) => Promise<AccountOperationResult>;
  switchingAccountId: number | null;
}

/**
 * Switches the active account and refreshes everything that belongs to it
 * (legacy useAccountSwitcher). A failure result whose message contains
 * 「已失效」 means that account needs a password: send it to
 * `/reauth/[accountId]`.
 */
export function useSwitchAccount(): SwitchAccountState {
  const runtime = useServiceRuntime();
  const queryClient = useQueryClient();
  const [switchingAccountId, setSwitchingAccountId] = useState<number | null>(
    null,
  );

  const switchAccount = useCallback(
    async (accountId: number): Promise<AccountOperationResult> => {
      setSwitchingAccountId(accountId);

      try {
        const result = await runtime.run('accounts.switch', () =>
          runtime.services.account.switchTo(accountId),
        );

        if (result.accounts !== undefined) {
          queryClient.setQueryData(queryKeys.accounts, result.accounts);
        }

        if (result.ok) {
          await runtime.resetForAccountChange();
        }

        return result;
      } finally {
        setSwitchingAccountId(null);
      }
    },
    [runtime, queryClient],
  );

  return { switchAccount, switchingAccountId };
}
