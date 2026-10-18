import { colorScheme, useColorScheme, vars } from 'nativewind';
import { useEffect, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';

import { accentPalettes, type AccentName } from './palettes';

export type Appearance = 'system' | 'light' | 'dark';

export function createThemeVars(accent: AccentName = 'warm') {
  const palette = accentPalettes[accent];

  return vars(
    Object.fromEntries(
      Object.entries(palette).map(([shade, color]) => [
        `--color-theme-${shade}`,
        color,
      ]),
    ),
  );
}

export interface ThemeProviderProps {
  accent?: AccentName;
  /** The Appearance preference; `system` follows the OS. */
  appearance?: Appearance;
  children: ReactNode;
}

/**
 * Exposes the selected accent palette to `theme-*` utilities and applies the
 * Appearance preference to NativeWind's `dark:` variant.
 */
export function ThemeProvider({
  accent = 'warm',
  appearance = 'system',
  children,
}: ThemeProviderProps) {
  const style = useMemo(() => createThemeVars(accent), [accent]);

  useEffect(() => {
    colorScheme.set(appearance);
  }, [appearance]);

  return (
    <View className="flex-1" style={style}>
      {children}
    </View>
  );
}

/** Whether `dark:` styles are currently active. */
export function useIsDark(): boolean {
  return useColorScheme().colorScheme === 'dark';
}
