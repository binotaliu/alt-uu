import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

/** Tailwind `md` (legacy `isTabletOrAbove`). */
export const TABLET_MIN_WIDTH = 768;

/** True on tablet-width windows, including a split-view iPad. */
export function useIsTablet(): boolean {
  return useWindowDimensions().width >= TABLET_MIN_WIDTH;
}

/**
 * Course card columns (legacy `sm:grid-cols-2 xl:grid-cols-3`: 640 / 1280
 * Tailwind breakpoints).
 */
export function useCardColumns(): 1 | 2 | 3 {
  const { width } = useWindowDimensions();

  return width >= 1280 ? 3 : width >= 640 ? 2 : 1;
}

/**
 * Set when a navigation bar already sits above the page header and has
 * consumed the top safe-area inset (tablet main screen).
 */
export const NavAboveHeaderContext = createContext(false);

export function useNavAboveHeader(): boolean {
  return useContext(NavAboveHeaderContext);
}
