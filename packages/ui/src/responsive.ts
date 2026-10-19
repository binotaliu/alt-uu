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

/**
 * Set by `Screen` once it pads the left/right safe-area insets, so headers
 * inside it neither pad them again nor stop their bar short of the screen edge.
 */
export const HorizontalInsetsAppliedContext = createContext(false);

export function useHorizontalInsetsApplied(): boolean {
  return useContext(HorizontalInsetsAppliedContext);
}

export interface CornerInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const NO_CORNER_INSETS: CornerInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Space the system keeps for the iPadOS 26 window controls (legacy
 * `--corner-inset-*`). Provided by the app shell; zeros without a provider.
 */
export const CornerInsetsContext =
  createContext<CornerInsets>(NO_CORNER_INSETS);

export function useCornerInsets(): CornerInsets {
  return useContext(CornerInsetsContext);
}
