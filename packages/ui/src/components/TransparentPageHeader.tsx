import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCornerInsets, useIsTablet, useNavAboveHeader } from '../responsive';
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

  return (
    <View
      className="bg-theme-100 py-1.5 dark:bg-zinc-950"
      style={{
        paddingTop: navAbove ? 6 : insets.top + 6,
        // The row below already pads 16.
        paddingLeft: Math.max(insets.left, corner.left - 16),
        paddingRight: Math.max(insets.right, corner.right - 16),
      }}
    >
      {nav ? <View className="mb-2">{nav}</View> : null}

      <View className="flex-row items-center justify-between gap-2 px-4 pt-0.5">
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
