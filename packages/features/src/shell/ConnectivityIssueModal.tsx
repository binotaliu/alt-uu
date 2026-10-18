import { Sheet, Text } from '@altuu/ui';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useConnectivityStore } from '../services/stores';

/** Suggests the connectivity diagnostics after repeated failed retries. */
export function ConnectivityIssueModal() {
  const promptOpen = useConnectivityStore((state) => state.promptOpen);
  const close = useConnectivityStore((state) => state.close);
  const noteDiagnosticsRun = useConnectivityStore(
    (state) => state.noteDiagnosticsRun,
  );

  const dismiss = () => {
    noteDiagnosticsRun();
    close();
  };

  const goToDiagnostics = () => {
    noteDiagnosticsRun();
    close();
    router.push('/settings/diagnostics');
  };

  return (
    <Sheet visible={promptOpen} onClose={dismiss}>
      <View className="px-5 py-4">
        <Text className="text-lg font-semibold text-theme-900 dark:text-zinc-100">
          連線似乎有問題
        </Text>
        <Text className="mt-1 text-sm text-theme-700 dark:text-zinc-400">
          Alt UU
          目前無法正常連線至伺服器，可能是您的網路，也可能是學校系統暫時無法使用。您可以前往連線診斷頁面檢視詳細狀態。
        </Text>
      </View>

      <View className="flex-row border-t border-theme-200 dark:border-zinc-700">
        <Pressable
          accessibilityRole="button"
          className="flex-1 px-5 py-3"
          onPress={dismiss}
        >
          <Text className="text-center text-sm text-theme-700 dark:text-zinc-300">
            稍後再說
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          className="flex-1 border-l border-theme-200 px-5 py-3 dark:border-zinc-700"
          onPress={goToDiagnostics}
        >
          <Text className="text-center text-sm font-medium text-theme-900 dark:text-zinc-100">
            前往診斷
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
