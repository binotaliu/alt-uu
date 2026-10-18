import type { EntitlementViewModel } from '@altuu/core';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { useServiceRuntime } from '../../services/AppServicesProvider';
import { useCachedEntitlement } from '../../services/hooks';
import { queryKeys } from '../../services/queryKeys';

export interface SubscriptionStatus {
    /** `undefined` until the cached entitlement has been read. */
    entitlement: EntitlementViewModel | undefined;
    isLoaded: boolean;
    active: boolean;
    /** Re-checks the backend (legacy `loadStatus(true)`). Never rejects. */
    refresh: () => Promise<void>;
    /** Stores a purchase / restore result so every screen sees it at once. */
    applyEntitlement: (entitlement: EntitlementViewModel) => Promise<void>;
}

/**
 * Legacy subscription store: the cached entitlement answers immediately, the
 * backend check corrects it in the background. A lapsed subscription resets
 * the accent colour in storage, so preferences are reloaded when it is off.
 */
export function useSubscriptionStatus({
    refreshOnMount = true,
}: { refreshOnMount?: boolean } = {}): SubscriptionStatus {
    const runtime = useServiceRuntime();
    const queryClient = useQueryClient();
    const cached = useCachedEntitlement();

    const applyEntitlement = useCallback(
        async (entitlement: EntitlementViewModel) => {
            queryClient.setQueryData(queryKeys.entitlement, entitlement);

            if (!entitlement.active) {
                await runtime.loadPreferences().catch(() => undefined);
            }
        },
        [queryClient, runtime],
    );

    const refresh = useCallback(async () => {
        try {
            const entitlement = await runtime.run('subscription.status', () =>
                runtime.services.subscription.getEntitlementStatus(),
            );
            await applyEntitlement(entitlement);
        } catch {
            // Keep whatever is cached rather than downgrading.
        }
    }, [runtime, applyEntitlement]);

    useEffect(() => {
        if (refreshOnMount) {
            void refresh();
        }
    }, [refreshOnMount, refresh]);

    return {
        entitlement: cached.data,
        isLoaded: cached.data !== undefined,
        active: cached.data?.active ?? false,
        refresh,
        applyEntitlement,
    };
}

export function formatExpiry(value: string | null): string {
    if (!value) {
        return '';
    }

    const date = new Date(value);

    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}
