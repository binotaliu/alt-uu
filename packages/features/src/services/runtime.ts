import {
  SessionInvalidError,
  type AccountViewModel,
  type AppPreferences,
  type AppPreferencesUpdate,
} from '@altuu/core';
import type { QueryClient } from '@tanstack/react-query';
import { router as expoRouter } from 'expo-router';

import { queryKeys } from './queryKeys';
import { toServiceError } from './serviceError';
import {
  defaultPreferences,
  useBootstrapStore,
  useClientConfigStore,
  useConnectivityStore,
  useSessionExpiryStore,
  type InitialRoute,
} from './stores';
import type { OperationKey } from './operations';
import type { AppServices } from './types';

/** The slice of the expo-router imperative API the shell uses. */
export interface RouterLike {
  push(href: string): void;
  replace(href: string): void;
}

export interface ServiceRuntimeOptions {
  services: AppServices;
  queryClient: QueryClient;
  router?: RouterLike;
}

export interface RunOptions {
  /** Overrides the summary recorded for the operation. */
  summary?: string;
}

export interface ServiceRuntime {
  services: AppServices;
  queryClient: QueryClient;
  /**
   * Runs `work` as operation `op`: upstream calls made meanwhile are
   * attributed to it in the diagnostics log, its outcome is recorded, and a
   * failure is thrown as a {@link ServiceError} (a dead session also opens
   * the re-login flow).
   */
  run<T>(
    op: OperationKey,
    work: () => Promise<T> | T,
    options?: RunOptions,
  ): Promise<T>;
  /** Entry point for "the active account's HUNGU session is dead". */
  handleSessionInvalid(failedAccountId: number | null): Promise<void>;
  /** Persists a preferences change and mirrors it into the client store. */
  updatePreferences(update: AppPreferencesUpdate): Promise<AppPreferences>;
  loadPreferences(): Promise<AppPreferences>;
  /** Reloads the active account's profile into the client store. */
  refreshSession(): Promise<void>;
  /** Drops cached server data after switching to another account. */
  resetForAccountChange(): Promise<void>;
  /** Decides the first route and loads the preferences (no network). */
  loadInitialState(): Promise<InitialRoute>;
  /**
   * Validates the stored session once, then (best-effort) syncs the block
   * list and the subscription. Never throws.
   */
  runLaunchTasks(): Promise<void>;
  recordClientError(
    error: unknown,
    source: string,
    extra?: Record<string, unknown>,
  ): void;
  recordNavigation(to: string, from: string): void;
}

const LAST_DIAGNOSTICS_KEY = 'connectivity:last-diagnostics-at';
const REAUTH_PATH = /^\/(login|reauth)(\/|$)/;

export function createServiceRuntime(
  options: ServiceRuntimeOptions,
): ServiceRuntime {
  const { services, queryClient } = options;
  const router: RouterLike = options.router ?? expoRouter;
  let handlingSessionInvalid = false;

  const run: ServiceRuntime['run'] = async (op, work, runOptions) => {
    const startedAt = Date.now();

    try {
      return await services.diagnostics.trackOperation(op, work, {
        summary: runOptions?.summary,
      });
    } catch (error) {
      const serviceError = toServiceError(error, {
        operationKey: op,
        durationMs: Date.now() - startedAt,
      });

      if (error instanceof SessionInvalidError) {
        void runtime.handleSessionInvalid(error.failedAccountId);
      }

      throw serviceError;
    }
  };

  const fetchAccounts = (): Promise<AccountViewModel[]> =>
    run('accounts.list', () => services.account.list());

  /**
   * Offers an account picker when other valid profiles exist, otherwise
   * sends the user to a re-login screen scoped to the account that failed
   * (legacy useSessionExpiry.handleSessionInvalid).
   */
  const handleSessionInvalid = async (
    failedAccountId: number | null,
  ): Promise<void> => {
    if (handlingSessionInvalid) {
      return;
    }

    // Set before the first await so a second concurrent 401 cannot slip
    // past the guard while the account list is loading.
    handlingSessionInvalid = true;

    try {
      const expiry = useSessionExpiryStore.getState();

      if (REAUTH_PATH.test(expiry.currentPath)) {
        return;
      }

      // A failed remembered login soft-deletes the account before the
      // error even reaches us, so a concurrent request can report no id.
      // Fall back to whichever account the already-loaded list last saw
      // as active.
      const previous =
        queryClient.getQueryData<AccountViewModel[]>(queryKeys.accounts) ?? [];
      const resolvedAccountId =
        failedAccountId ??
        previous.find((account) => account.isActive)?.id ??
        null;

      const accounts = await queryClient.fetchQuery({
        queryKey: queryKeys.accounts,
        queryFn: fetchAccounts,
        staleTime: 0,
      });
      const others = accounts.filter(
        (account) => account.id !== resolvedAccountId,
      );

      if (others.length === 0 && resolvedAccountId === null) {
        router.push('/login');

        return;
      }

      if (others.length > 0) {
        useSessionExpiryStore.getState().openPicker(resolvedAccountId);

        return;
      }

      useSessionExpiryStore
        .getState()
        .setReturnTo(useSessionExpiryStore.getState().currentPath);
      router.push(`/reauth/${resolvedAccountId}`);
    } finally {
      handlingSessionInvalid = false;
    }
  };

  const loadPreferences = async (): Promise<AppPreferences> => {
    const preferences = await run('app.preferences', () =>
      services.appPreference.get(),
    );
    useClientConfigStore.getState().applyPreferences(preferences);

    return preferences;
  };

  const updatePreferences = async (
    update: AppPreferencesUpdate,
  ): Promise<AppPreferences> => {
    const preferences = await run('app.preferences', () =>
      services.appPreference.update(update),
    );
    useClientConfigStore.getState().applyPreferences(preferences);

    return preferences;
  };

  const refreshSession = async (): Promise<void> => {
    try {
      const profile = await run('auth.profile', () =>
        services.auth.getSessionProfile(),
      );
      useClientConfigStore.getState().setSession('authenticated', profile);
      queryClient.setQueryData(queryKeys.sessionProfile, profile);
    } catch {
      // A dead session already started the re-login flow; anything else
      // leaves the previous state in place.
    }
  };

  const syncModeration = async (): Promise<void> => {
    try {
      await run('moderation.sync', () =>
        services.moderation.syncBlockedContents(),
      );
    } catch {
      // Best-effort: the local block list keeps working.
    }
  };

  const refreshSubscription = async (): Promise<void> => {
    try {
      await run('subscription.status', () =>
        services.subscription.getEntitlementStatus(),
      );
      // A lapsed subscription resets the accent colour in storage;
      // follow it in the client store.
      await loadPreferences();
    } catch {
      // Keep whatever is cached rather than downgrading.
    }
  };

  const runtime: ServiceRuntime = {
    services,
    queryClient,
    run,
    handleSessionInvalid,
    updatePreferences,
    loadPreferences,
    refreshSession,

    async resetForAccountChange() {
      await queryClient.resetQueries();
      await refreshSession();
      void syncModeration();
    },

    async loadInitialState() {
      let preferences = defaultPreferences;

      try {
        preferences = await loadPreferences();
      } catch {
        // Fall back to defaults so the app can still open.
      }

      let hasAccounts = false;

      try {
        hasAccounts = await services.account.hasAny();
      } catch {
        hasAccounts = false;
      }

      const initialRoute: InitialRoute = !preferences.onboardingCompleted
        ? '/onboarding'
        : hasAccounts
          ? '/courses'
          : '/login';

      // Keeps the "diagnostics were just offered" quiet period across
      // launches.
      try {
        const stored =
          await services.storage.keyValues.get(LAST_DIAGNOSTICS_KEY);
        useConnectivityStore.getState().hydrate(Number(stored) || 0);
      } catch {
        // In-memory value only.
      }

      useBootstrapStore.getState().setReady(initialRoute);

      return initialRoute;
    },

    async runLaunchTasks() {
      try {
        if (!(await services.account.hasAny())) {
          useClientConfigStore.getState().setSession('unauthenticated');

          return;
        }

        // Read before validating: a failed remembered login
        // soft-deletes the account but leaves it as the active
        // profile, which is how we know who to ask to re-login.
        const activeAccountId = await services.storage.activeProfile.get();
        const result = await run('auth.bootstrap', () =>
          services.auth.bootstrapSession(),
        );

        if (!result.authenticated) {
          useClientConfigStore.getState().setSession('unauthenticated');
          await handleSessionInvalid(activeAccountId);

          return;
        }

        await refreshSession();
        void syncModeration();
        void refreshSubscription();
      } catch {
        // Offline or upstream down: the screens surface their own
        // errors, and the session is re-validated on the next launch.
      }
    },

    recordClientError(error, source, extra = {}) {
      if (error instanceof Error && error.name === 'ServiceError') {
        // A failed service call already has its own, richer entry.
        return;
      }

      const asError = error instanceof Error ? error : null;

      void services.diagnostics
        .storeClientEvents([
          {
            occurredAt: new Date().toISOString(),
            type: 'client.error',
            level: 'error',
            summary: asError
              ? `${asError.name}: ${asError.message}`
              : String(error),
            context: {
              source,
              stack:
                asError?.stack?.split('\n').slice(0, 12).join('\n') ?? null,
              ...extra,
            },
          },
        ])
        .catch(() => undefined);
    },

    recordNavigation(to, from) {
      void services.diagnostics
        .storeClientEvents([
          {
            occurredAt: new Date().toISOString(),
            type: 'client.nav',
            level: 'info',
            summary: `${from} → ${to}`,
          },
        ])
        .catch(() => undefined);
    },
  };

  // Persist the diagnostics quiet period whenever it changes.
  useConnectivityStore.subscribe((state, previous) => {
    if (state.lastDiagnosticsAt !== previous.lastDiagnosticsAt) {
      void services.storage.keyValues
        .set(LAST_DIAGNOSTICS_KEY, String(state.lastDiagnosticsAt))
        .catch(() => undefined);
    }
  });

  return runtime;
}
