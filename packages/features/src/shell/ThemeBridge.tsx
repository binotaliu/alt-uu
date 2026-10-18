import { ThemeProvider } from '@altuu/ui';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';

import { useAppPreferences } from '../services/hooks';

/**
 * Applies the appearance and accent preferences to the UI and keeps the
 * status bar legible. The native status bar style names describe the icons,
 * so `auto` follows the resolved scheme (system, or the forced one).
 */
export function ThemeBridge({ children }: { children: ReactNode }) {
  const { appearance, accentColor } = useAppPreferences();

  return (
    <ThemeProvider accent={accentColor} appearance={appearance}>
      <StatusBar
        style={
          appearance === 'system'
            ? 'auto'
            : appearance === 'dark'
              ? 'light'
              : 'dark'
        }
      />
      {children}
    </ThemeProvider>
  );
}
