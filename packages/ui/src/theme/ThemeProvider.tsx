import { vars } from 'nativewind';
import { useMemo, type ReactNode } from 'react';
import { View } from 'react-native';

import { accentPalettes, type AccentName } from './palettes';

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
    children: ReactNode;
}

/** Exposes the selected accent palette to `theme-*` utilities. */
export function ThemeProvider({
    accent = 'warm',
    children,
}: ThemeProviderProps) {
    const style = useMemo(() => createThemeVars(accent), [accent]);

    return (
        <View className="flex-1" style={style}>
            {children}
        </View>
    );
}
