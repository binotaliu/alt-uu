import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

/** Tailwind `md` (legacy `isTabletOrAbove`). */
export const TABLET_MIN_WIDTH = 768;

/** True on tablet-width windows, including a split-view iPad. */
export function useIsTablet(): boolean {
  return useWindowDimensions().width >= TABLET_MIN_WIDTH;
}

/**
 * Card grid columns (Tailwind `grid-cols-1 <breakpoint>:grid-cols-2
 * xl:grid-cols-3`). `twoColumnsFrom` is the width where the second column
 * starts: 640 for `sm`, 768 for `md`.
 */
export function useCardColumns(twoColumnsFrom = 640): 1 | 2 | 3 {
  const { width } = useWindowDimensions();

  return width >= 1280 ? 3 : width >= twoColumnsFrom ? 2 : 1;
}

/**
 * Set when a navigation bar already sits above the page header and has
 * consumed the top safe-area inset (tablet main screen).
 */
export const NavAboveHeaderContext = createContext(false);

export function useNavAboveHeader(): boolean {
  return useContext(NavAboveHeaderContext);
}
