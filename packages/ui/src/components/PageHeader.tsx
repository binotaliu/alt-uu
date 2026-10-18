import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCornerInsets } from '../responsive';
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

  return (
    <View
      className="flex-row items-stretch border-b border-theme-200 bg-white pl-4 pr-4 dark:border-zinc-700/80 dark:bg-zinc-900"
      style={{
        paddingTop: insets.top,
        paddingLeft: Math.max(insets.left, corner.left, 16),
        paddingRight: Math.max(insets.right, corner.right, 16),
      }}
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
