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

export interface FoldFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Which iPhone Duo display the window is on; `other` for every other device. */
export type DuoDisplay = 'outer' | 'inner' | 'other';

export interface DuoLayout {
  /** The device reports a fold (iPhone Duo, iOS 27.1+), flat or not. */
  isFoldable: boolean;
  display: DuoDisplay;
  /** Window rect of the fold while the device is folded, otherwise null. */
  foldFrame: FoldFrame | null;
  /** Direction of the fold line: `vertical` puts the two panes side by side. */
  foldAxis: 'vertical' | 'horizontal' | null;
  /**
   * Navigation moves to a vertical bar on the trailing edge: always on the outer
   * display, and on the inner display in landscape. Inner portrait keeps the
   * horizontal bars.
   */
  sideBar: boolean;
  /**
   * Edge of the side bar: the one the system keeps for the status area, which turns
   * with the device (the camera side).
   */
  barEdge: 'left' | 'right';
  /** Width the system reserves on `barEdge`, 0 when it reports none. */
  barWidth: number;
  /** Space the bar leaves at its ends for the status area / camera block. */
  barClearance: { top: number; bottom: number };
}

export const NOT_FOLDABLE: DuoLayout = {
  isFoldable: false,
  display: 'other',
  foldFrame: null,
  foldAxis: null,
  sideBar: false,
  barEdge: 'right',
  barWidth: 0,
  barClearance: { top: 0, bottom: 0 },
};

/** Provided by the app shell; `NOT_FOLDABLE` without a provider. */
export const DuoLayoutContext = createContext<DuoLayout>(NOT_FOLDABLE);

export function useDuoLayout(): DuoLayout {
  return useContext(DuoLayoutContext);
}

/**
 * Width the system status area (time, connectivity) takes at the trailing end of the top
 * strip on the iPhone Duo inner display in portrait. No API reports it, so it is measured
 * from the simulator: widen it if the title row runs into the status icons.
 */
export const DUO_STATUS_AREA_WIDTH = 140;

/** The clock sits this far below the middle of the top strip (measured in the simulator). */
export const DUO_CLOCK_OFFSET = 9;

/** Extra margin (pt) around headers on a foldable, whose rounded corners crowd the title. */
export const DUO_CORNER_MARGIN = 12;
