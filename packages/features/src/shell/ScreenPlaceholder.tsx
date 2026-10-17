import { PageHeader, Screen, Text } from '@altuu/ui';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

export interface ScreenPlaceholderProps {
    /** Route name shown on the placeholder, e.g. `courses/[cid]`. */
    name: string;
    /** Hide the header (tab screens have their own). */
    bare?: boolean;
}

/**
 * Stand-in for screens that are built in later steps. A route file replaces
 * it by importing the real screen from `packages/features/src/<area>/`.
 */
export function ScreenPlaceholder({
    name,
    bare = false,
}: ScreenPlaceholderProps) {
    const params = useLocalSearchParams();
    const entries = Object.entries(params);

    return (
        <Screen ignoreTopInset={!bare} ignoreBottomInset={!bare}>
            {bare ? null : <PageHeader title={name} />}
            <View className="flex-1 items-center justify-center gap-2 p-6">
                <Text
                    accessibilityRole="header"
                    className="text-lg font-semibold"
                >
                    {name}
                </Text>
                <Text className="text-sm text-theme-700 dark:text-zinc-400">
                    此畫面尚未完成
                </Text>
                {entries.map(([key, value]) => (
                    <Text
                        key={key}
                        className="font-mono text-xs text-theme-700 dark:text-zinc-400"
                    >
                        {`${key}=${Array.isArray(value) ? value.join(',') : value}`}
                    </Text>
                ))}
            </View>
        </Screen>
    );
}
