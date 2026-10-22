import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useCornerInsets,
  useDuoLayout,
  useHorizontalInsetsApplied,
  useIsTablet,
  useNavAboveHeader,
} from '../responsive';
import { Text } from './Text';

/**
 * Width the system status area (time, connectivity) takes at the trailing end of the top
 * strip on the iPhone Duo inner display in portrait. No API reports it, so it is measured
 * from the simulator: widen it if the title row runs into the status icons.
 */
export const DUO_STATUS_AREA_WIDTH = 140;

/** The clock sits this far below the middle of the top strip (measured in the simulator). */
const DUO_CLOCK_OFFSET = 9;

export interface TransparentPageHeaderProps {
  title: string;
  /** Rendered above the title row (legacy `nav` slot). */
  nav?: ReactNode;
  icon?: ReactNode;
  /** Right side of the title row (legacy `actions` slot). */
  actions?: ReactNode;
}

/** Legacy TransparentPageHeader: tab-screen title on the page background. */
export function TransparentPageHeader({
  title,
  nav,
  icon,
  actions,
}: TransparentPageHeaderProps) {
  const insets = useSafeAreaInsets();
  const corner = useCornerInsets();
  const isTablet = useIsTablet();
  const navAbove = useNavAboveHeader();
  const insetsApplied = useHorizontalInsetsApplied();
  const { isFoldable, sideBar } = useDuoLayout();
  // Inner display in portrait: the top strip is tall and mostly empty, so the title row
  // moves into it, beside the status area, instead of sitting below.
  const inStatusStrip = isFoldable && !sideBar && !navAbove;
  const sideInsets = insetsApplied ? { left: 0, right: 0 } : insets;

  return (
    <View
      className="bg-theme-100 py-1.5 dark:bg-zinc-950"
      style={{
        paddingTop: inStatusStrip ? 0 : navAbove ? 6 : insets.top + 6,
        ...(inStatusStrip
          ? {
              height: Math.max(insets.top, 56),
              justifyContent: 'center',
              paddingVertical: 0,
              paddingTop: DUO_CLOCK_OFFSET * 2,
            }
          : null),
        // The row below already pads 16.
        paddingLeft: Math.max(sideInsets.left, corner.left - 16),
        paddingRight: Math.max(sideInsets.right, corner.right - 16),
      }}
    >
      {nav ? <View className="mb-2">{nav}</View> : null}

      <View
        className="flex-row items-center justify-between gap-2 px-4 pt-0.5"
        style={inStatusStrip ? { paddingRight: DUO_STATUS_AREA_WIDTH } : null}
      >
        <View className="flex-row items-center gap-2">
          {icon}
          <Text
            className={`font-semibold text-theme-900 dark:text-zinc-100 ${isTablet ? 'text-xl' : 'text-lg'}`}
          >
            {title}
          </Text>
        </View>
        {actions}
      </View>
    </View>
  );
}
