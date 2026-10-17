import { Button, Screen, Text } from '@altuu/ui';
import { View } from 'react-native';

export interface FatalErrorScreenProps {
    error: unknown;
    onRetry: () => void;
}

/** Shown when the services could not be created (database open / migration failed). */
export function FatalErrorScreen({ error, onRetry }: FatalErrorScreenProps) {
    const detail = error instanceof Error ? error.message : String(error);

    return (
        <Screen className="items-center justify-center px-6">
            <View className="w-full max-w-sm gap-3">
                <Text className="text-center text-lg font-semibold">
                    Alt UU 無法啟動
                </Text>
                <Text className="text-center text-sm text-theme-700 dark:text-zinc-400">
                    初始化時發生錯誤，請重試。若問題持續發生，請重新啟動 App。
                </Text>
                <Text className="text-center font-mono text-xs text-rose-700 dark:text-rose-300">
                    {detail}
                </Text>
                <Button label="重試" onPress={onRetry} />
            </View>
        </Screen>
    );
}
