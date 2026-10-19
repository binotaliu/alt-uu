import { Text } from '@altuu/ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToastStore } from '../services/stores';

const TOAST_DURATION_MS = 4000;

/** Renders the message of {@link useToastStore} for a few seconds. */
export function AppToastHost() {
  const insets = useSafeAreaInsets();
  const message = useToastStore((state) => state.message);
  const id = useToastStore((state) => state.id);

  useEffect(() => {
    if (message === null) {
      return;
    }

    const timer = setTimeout(
      () => useToastStore.getState().hide(),
      TOAST_DURATION_MS,
    );

    return () => clearTimeout(timer);
  }, [message, id]);

  if (message === null) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      className="absolute left-0 right-0 items-center px-4"
      style={{ top: insets.top + 8 }}
      accessibilityLiveRegion="polite"
    >
      <View className="w-full max-w-md rounded-2xl border border-theme-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
          {message}
        </Text>
      </View>
    </View>
  );
}
