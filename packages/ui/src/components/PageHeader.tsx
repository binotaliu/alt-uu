import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DUO_CLOCK_OFFSET,
  DUO_STATUS_AREA_WIDTH,
  useCornerInsets,
  useDuoLayout,
  useHorizontalInsetsApplied,
} from '../responsive';
import { BackButton } from './BackButton';
import { Text } from './Text';

export interface PageHeaderProps {
  title: string;
  subtitle?: string | null;
  showBack?: boolean;
  backHref?: Href;
  onBack?: () => void;
  isLoading?: boolean;
  /** Replaces the back button. */
  left?: ReactNode;
  right?: ReactNode;
  below?: ReactNode;
}

/** Legacy PageHeader: white bar with a bottom border, back button, title and subtitle. */
export function PageHeader({
  title,
  subtitle,
  showBack = true,
  backHref,
  onBack,
  isLoading = false,
  left,
  right,
  below,
}: PageHeaderProps) {
  const insets = useSafeAreaInsets();
  const corner = useCornerInsets();
  const insetsApplied = useHorizontalInsetsApplied();
  const { width: windowWidth } = useWindowDimensions();
  const { isFoldable, sideBar, foldFrame, foldAxis } = useDuoLayout();
  // Inner display in portrait: the tall top strip is mostly empty, so the title row moves
  // into it, beside the status area, instead of sitting below.
  const inStatusStrip = isFoldable && !sideBar;
  // The rounded corners of the foldable make a 16 pt margin too tight to tap the back button.
  const minSide = isFoldable ? 28 : 16;
  // The bar spans the window, but its content stays left of a vertical fold.
  const foldClearance =
    foldFrame && foldAxis === 'vertical'
      ? windowWidth - foldFrame.x + minSide
      : 0;

  const barStyle = {
    // Bleed the bar over the inset the parent Screen already padded.
    marginLeft: insetsApplied ? -insets.left : 0,
    marginRight: insetsApplied ? -insets.right : 0,
    paddingLeft: Math.max(insets.left, corner.left, minSide),
    paddingRight: Math.max(
      insets.right,
      corner.right,
      minSide,
      foldClearance,
      inStatusStrip ? DUO_STATUS_AREA_WIDTH : 0,
    ),
  };

  if (inStatusStrip) {
    return (
      <View
        className="border-b border-theme-200 bg-white dark:border-zinc-700/80 dark:bg-zinc-900"
        style={barStyle}
      >
        <View
          className="flex-row items-center"
          style={{
            height: Math.max(insets.top, 56),
            paddingTop: DUO_CLOCK_OFFSET * 2,
          }}
        >
          {left ??
            (showBack ? <BackButton href={backHref} onPress={onBack} /> : null)}
          <View className="min-w-0 flex-1 justify-center">
            <Text
              numberOfLines={1}
              className="text-base font-semibold text-theme-900 dark:text-zinc-100"
            >
              {isLoading ? '' : title}
            </Text>
          </View>
          {right ? (
            <View className="ml-2 shrink-0 flex-row items-center gap-2">
              {right}
            </View>
          ) : null}
        </View>
        {subtitle || below ? (
          <View className="pb-3 pl-12">
            {subtitle ? (
              <Text
                numberOfLines={1}
                className="text-sm text-theme-700 dark:text-zinc-300"
              >
                {subtitle}
              </Text>
            ) : null}
            {below ? (
              <View className={subtitle ? 'mt-1' : ''}>{below}</View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View
      className="flex-row items-stretch border-b border-theme-200 bg-white pl-4 pr-4 dark:border-zinc-700/80 dark:bg-zinc-900"
      style={{ paddingTop: insets.top, ...barStyle }}
    >
      <View className="shrink-0 items-start pt-1.5">
        {left ??
          (showBack ? <BackButton href={backHref} onPress={onBack} /> : null)}
      </View>

      <View className="min-w-0 flex-1 justify-center pb-3 pt-1.5">
        {isLoading ? (
          <View>
            <View className="h-6 w-20 rounded bg-theme-200 dark:bg-zinc-700" />
            <View className="mt-1 h-6 w-36 rounded bg-theme-200 dark:bg-zinc-700" />
          </View>
        ) : (
          <>
            <Text
              numberOfLines={1}
              className="text-base font-semibold text-theme-900 dark:text-zinc-100"
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                numberOfLines={1}
                className="mt-1 text-sm text-theme-700 dark:text-zinc-300"
              >
                {subtitle}
              </Text>
            ) : null}
            {below ? <View className="mt-1">{below}</View> : null}
          </>
        )}
      </View>

      {right ? (
        <View className="ml-2 shrink-0 flex-row items-center gap-2">
          {right}
        </View>
      ) : null}
    </View>
  );
}
