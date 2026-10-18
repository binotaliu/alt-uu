import * as Linking from 'expo-linking';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect } from 'react';

/**
 * Dev only: exposes `deeplink()` on globalThis so the current page's deep link
 * can be read from the React Native DevTools console. Renders nothing.
 */
export function DevDeepLinkHelper() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();

  useEffect(() => {
    const globals = globalThis as { deeplink?: () => string };
    globals.deeplink = () =>
      Linking.createURL(pathname, { queryParams: params });

    return () => {
      delete globals.deeplink;
    };
  }, [pathname, params]);

  return null;
}
