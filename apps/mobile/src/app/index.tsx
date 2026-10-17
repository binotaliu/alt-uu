import { Screen, Text } from '@altuu/ui';

export default function HomeRoute() {
    return (
        <Screen className="items-center justify-center gap-2">
            <Text className="text-2xl font-bold text-theme-700 dark:text-theme-200">
                Alt UU
            </Text>
            <Text className="text-theme-600 dark:text-theme-300">
                Hello from React Native
            </Text>
        </Screen>
    );
}
