import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useServiceRuntime } from '../services/AppServicesProvider';
import { useSessionExpiryStore } from '../services/stores';

/**
 * Mirrors the current route into the session-expiry store (the flow must know
 * whether the user is already on /login or /reauth) and records navigations
 * in the diagnostics log. Renders nothing.
 */
export function NavigationTracker() {
  const pathname = usePathname();
  const runtime = useServiceRuntime();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    useSessionExpiryStore.getState().setCurrentPath(pathname);

    if (previous.current !== null && previous.current !== pathname) {
      runtime.recordNavigation(pathname, previous.current);
    }

    previous.current = pathname;
  }, [pathname, runtime]);

  return null;
}
