import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DUO_CLOCK_OFFSET,
  DUO_CORNER_MARGIN,
  DUO_STATUS_AREA_WIDTH,
  useCornerInsets,
  useDuoLayout,
  useHorizontalInsetsApplied,
  useIsTablet,
  useNavAboveHeader,
} from '../responsive';
import { Text } from './Text';

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
  const { isFoldable, sideBar, barEdge } = useDuoLayout();
  // Inner display in portrait: the top strip is tall and mostly empty, so the title row
  // moves into it, beside the status area, instead of sitting below.
  const inStatusStrip = isFoldable && !sideBar && !navAbove;
  const sideInsets = insetsApplied ? { left: 0, right: 0 } : insets;
  // The side rail already reserves its edge (the corner insets include the status strip
  // it sits in), so the header adds nothing there. The rounded corners of a foldable need
  // a wider margin on the other sides than the 16 pt the row pads.
  const railEdge = sideBar ? barEdge : null;
  const duoMargin = isFoldable ? DUO_CORNER_MARGIN : 0;
  const leftPadding =
    railEdge === 'left'
      ? 0
      : Math.max(sideInsets.left, corner.left - 16, duoMargin);
  const rightPadding =
    railEdge === 'right'
      ? 0
      : Math.max(sideInsets.right, corner.right - 16, duoMargin);

  return (
    <View
      className="bg-theme-100 py-1.5 dark:bg-zinc-950"
      style={{
        paddingTop: inStatusStrip
          ? 0
          : (navAbove ? 6 : insets.top + 6) + duoMargin,
        ...(inStatusStrip
          ? {
              height: Math.max(insets.top, 56),
              justifyContent: 'center',
              paddingVertical: 0,
              paddingTop: DUO_CLOCK_OFFSET * 2,
            }
          : null),
        // The row below already pads 16.
        paddingLeft: leftPadding,
        paddingRight: rightPadding,
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
