import { Text } from '@altuu/ui';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Card } from './primitives';

export function LoadingCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <Text
        accessibilityRole="progressbar"
        className="text-center text-sm text-theme-700 dark:text-zinc-400"
      >
        {children}
      </Text>
    </Card>
  );
}

export function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <View className="rounded-xl border border-dashed border-theme-300 bg-theme-50 p-4 dark:border-zinc-600 dark:bg-zinc-800">
      <Text className="text-center text-sm text-theme-700 dark:text-zinc-300">
        {children}
      </Text>
    </View>
  );
}
