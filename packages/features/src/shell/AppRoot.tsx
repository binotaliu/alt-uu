import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  AppServicesProvider,
  useServiceRuntime,
} from '../services/AppServicesProvider';
import { useBootstrapStore } from '../services/stores';
import type { AppServices } from '../services/types';
import { ConnectivityIssueModal } from './ConnectivityIssueModal';
import { CornerInsetsProvider } from './CornerInsetsProvider';
import { FatalErrorScreen } from './FatalErrorScreen';
import { NavigationTracker } from './NavigationTracker';
import { SessionExpiredPicker } from './SessionExpiredPicker';
import { ThemeBridge } from './ThemeBridge';
import { WhatsNewSheet } from './WhatsNewSheet';

export interface AppRootProps {
  /** The composition root: opens the platform, migrates, wires the services. */
  createServices: () => Promise<AppServices>;
  /** Called once the first route is known (hide the splash screen here). */
  onReady?: () => void;
  /** The navigator, e.g. expo-router's `<Stack />`. */
  children: ReactNode;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; services: AppServices }
  | { status: 'error'; error: unknown };

/**
 * Root of the app. Builds the services, wraps the tree in the providers and
 * overlays (session-expiry picker, connectivity prompt, What's new, theme),
 * and renders `children` only after the preferences are loaded, so the
 * first frame already has the right theme and the entry route is known.
 */
export function AppRoot({ createServices, onReady, children }: AppRootProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const started = useRef(false);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    createServices().then(
      (services) => setState({ status: 'ready', services }),
      (error: unknown) => setState({ status: 'error', error }),
    );
  }, [createServices]);

  useEffect(() => {
    if (started.current) {
      return;
    }

    started.current = true;
    load();
  }, [load]);

  useEffect(() => {
    if (state.status === 'error') {
      onReady?.();
    }
  }, [state.status, onReady]);

  return (
    <SafeAreaProvider>
      <CornerInsetsProvider>
        {state.status === 'ready' ? (
          <AppServicesProvider services={state.services}>
            <ThemeBridge>
              <Launch onReady={onReady}>{children}</Launch>
            </ThemeBridge>
          </AppServicesProvider>
        ) : state.status === 'error' ? (
          <FatalErrorScreen error={state.error} onRetry={load} />
        ) : null}
      </CornerInsetsProvider>
    </SafeAreaProvider>
  );
}

/** Runs the launch sequence, then mounts the navigator and the overlays. */
function Launch({
  onReady,
  children,
}: {
  onReady?: () => void;
  children: ReactNode;
}) {
  const runtime = useServiceRuntime();
  const ready = useBootstrapStore((store) => store.ready);
  const loaded = useRef(false);
  const tasksStarted = useRef(false);

  useEffect(() => {
    if (loaded.current) {
      return;
    }

    loaded.current = true;
    void runtime.loadInitialState().then(() => onReady?.());
  }, [runtime, onReady]);

  // Background session validation starts once the navigator is mounted, so
  // an expired session can already route to the picker or /reauth.
  useEffect(() => {
    if (ready && !tasksStarted.current) {
      tasksStarted.current = true;
      void runtime.runLaunchTasks();
    }
  }, [ready, runtime]);

  if (!ready) {
    return null;
  }

  return (
    <>
      <NavigationTracker />
      {children}
      <SessionExpiredPicker />
      <ConnectivityIssueModal />
      <WhatsNewSheet />
    </>
  );
}
