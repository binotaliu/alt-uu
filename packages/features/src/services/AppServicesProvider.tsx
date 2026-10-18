import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import {
  createServiceRuntime,
  type RouterLike,
  type ServiceRuntime,
} from './runtime';
import type { AppServices } from './types';

const RuntimeContext = createContext<ServiceRuntime | null>(null);

/**
 * Query defaults: no automatic retries (the user retries from the error
 * panel, which feeds the connectivity prompt), data stays fresh for a minute
 * so tab switches do not refetch.
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export interface AppServicesProviderProps {
  services: AppServices;
  children: ReactNode;
  /** Injected in tests; defaults to a fresh client. */
  queryClient?: QueryClient;
  /** Injected in tests; defaults to expo-router's imperative router. */
  router?: RouterLike;
}

/**
 * Makes the app's services and the TanStack Query client available to every
 * screen. Mount once, near the root, after `createAppServices()` resolved.
 */
export function AppServicesProvider({
  services,
  children,
  queryClient,
  router,
}: AppServicesProviderProps) {
  const runtime = useMemo(
    () =>
      createServiceRuntime({
        services,
        queryClient: queryClient ?? createAppQueryClient(),
        router,
      }),
    [services, queryClient, router],
  );

  return (
    <QueryClientProvider client={runtime.queryClient}>
      <RuntimeContext.Provider value={runtime}>
        {children}
      </RuntimeContext.Provider>
    </QueryClientProvider>
  );
}

/** The runtime behind the hooks: `run`, session expiry, preferences. */
export function useServiceRuntime(): ServiceRuntime {
  const runtime = useContext(RuntimeContext);

  if (runtime === null) {
    throw new Error(
      'useServiceRuntime must be used inside <AppServicesProvider>.',
    );
  }

  return runtime;
}

/** The composed domain services (see {@link AppServices}). */
export function useAppServices(): AppServices {
  return useServiceRuntime().services;
}
