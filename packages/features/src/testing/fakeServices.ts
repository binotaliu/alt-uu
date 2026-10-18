import type { AppPreferences, AccountViewModel } from '@altuu/core';
import { QueryClient } from '@tanstack/react-query';

import { createServiceRuntime, type ServiceRuntime } from '../services/runtime';
import {
    defaultPreferences,
    useBootstrapStore,
    useClientConfigStore,
    useConnectivityStore,
    useSessionExpiryStore,
    useWhatsNewStore,
} from '../services/stores';
import type { AppServices } from '../services/types';

export function account(
    id: number,
    overrides: Partial<AccountViewModel> = {},
): AccountViewModel {
    return {
        id,
        username: `user${id}`,
        displayName: `User ${id}`,
        nickname: null,
        picture: '',
        isActive: false,
        ...overrides,
    };
}

export interface FakeServiceState {
    accounts: AccountViewModel[];
    preferences: AppPreferences;
    activeAccountId: number | null;
    bootstrap: () => Promise<{ authenticated: boolean }>;
    operations: Array<{ op: string; failed: boolean }>;
}

/**
 * A just-enough AppServices for hook and shell tests: the diagnostics tracker
 * records operation keys, everything else is configurable through `state`.
 */
export function createFakeServices(initial: Partial<FakeServiceState> = {}): {
    services: AppServices;
    state: FakeServiceState;
} {
    const state: FakeServiceState = {
        accounts: [],
        preferences: { ...defaultPreferences, onboardingCompleted: true },
        activeAccountId: null,
        bootstrap: async () => ({ authenticated: true }),
        operations: [],
        ...initial,
    };

    const services = {
        buildConfig: { appVersion: '1.1.0' },
        diagnostics: {
            trackOperation: async <T>(
                op: string,
                work: () => Promise<T> | T,
            ) => {
                try {
                    const result = await work();
                    state.operations.push({ op, failed: false });

                    return result;
                } catch (error) {
                    state.operations.push({ op, failed: true });
                    throw error;
                }
            },
            storeClientEvents: async () => 0,
        },
        storage: {
            activeProfile: { get: async () => state.activeAccountId },
            keyValues: {
                get: async () => null,
                set: async () => undefined,
            },
        },
        account: {
            list: async () => state.accounts,
            hasAny: async () => state.accounts.length > 0,
            switchTo: async () => ({
                ok: true as const,
                message: '' as const,
                accounts: state.accounts,
            }),
        },
        appPreference: {
            get: async () => state.preferences,
            update: async (update: Partial<AppPreferences>) => {
                state.preferences = { ...state.preferences, ...update };

                return state.preferences;
            },
        },
        auth: {
            bootstrapSession: async () => ({
                ok: true as const,
                ...(await state.bootstrap()),
                redirect: '/courses' as const,
                nouToolsIntegrationEnabled: false,
            }),
            getSessionProfile: async () => ({
                displayName: 'User',
                nickname: null,
                picture: null,
                username: 'user',
            }),
        },
        moderation: { syncBlockedContents: async () => undefined },
        subscription: {
            getEntitlementStatus: async () => ({
                active: false,
                productId: null,
                expiresAt: null,
                platform: null,
            }),
        },
    } as unknown as AppServices;

    return { services, state };
}

/**
 * Query client for tests. `gcTime: Infinity` keeps TanStack Query from
 * scheduling cache-eviction timers, which would otherwise keep Jest workers
 * alive after the suite finished.
 */
export function createTestQueryClient(
    queryDefaults: { staleTime?: number } = {},
): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: Infinity, ...queryDefaults },
            mutations: { retry: false, gcTime: Infinity },
        },
    });
}

export function createTestRuntime(initial: Partial<FakeServiceState> = {}): {
    runtime: ServiceRuntime;
    state: FakeServiceState;
    router: { push: jest.Mock; replace: jest.Mock };
    queryClient: QueryClient;
} {
    const { services, state } = createFakeServices(initial);
    const router = { push: jest.fn(), replace: jest.fn() };
    const queryClient = createTestQueryClient();

    return {
        runtime: createServiceRuntime({ services, queryClient, router }),
        state,
        router,
        queryClient,
    };
}

/** Resets the module-level stores between tests. */
export function resetStores(): void {
    useSessionExpiryStore.getState().reset();
    useClientConfigStore.getState().reset();
    useBootstrapStore.getState().reset();
    useConnectivityStore.setState({
        promptOpen: false,
        lastDiagnosticsAt: 0,
        retryTimestamps: [],
    });
    useWhatsNewStore.setState({ isOpen: false });
}
