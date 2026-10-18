import { accentPalettes, type AccentName } from '@altuu/ui';
import type { ViewStyle } from 'react-native';

/**
 * Legacy login / reauth / onboarding page background:
 * `radial-gradient(circle_at_top_right, oklch(0.98 0.03 40), white 45%,
 * oklch(0.96 0.02 40))` (oklch pre-converted to hex; RN has no oklch). Dark
 * mode keeps the flat `dark:bg-zinc-950` from the class name.
 */
export function authBackgroundStyle(isDark: boolean): ViewStyle | undefined {
  return isDark
    ? undefined
    : {
        backgroundImage:
          'radial-gradient(circle at top right, #fff2ea, #ffffff 45%, #ffeee8)',
      };
}

/**
 * Legacy Alt UU+ hero: `bg-gradient-to-br from-amber-500 via-orange-500
 * to-theme-700` (dark: `from-amber-600 via-orange-700 to-zinc-900`).
 */
export function subscriptionHeroStyle(
  isDark: boolean,
  accent: AccentName,
): ViewStyle {
  return {
    backgroundImage: isDark
      ? 'linear-gradient(to bottom right, #d97706, #c2410c, #18181b)'
      : `linear-gradient(to bottom right, #f59e0b, #f97316, ${accentPalettes[accent]['700']})`,
  };
}
