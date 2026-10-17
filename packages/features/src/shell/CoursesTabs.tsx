import { Button, Icon, Sheet, Text, type IconName } from '@altuu/ui';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useServiceRuntime } from '../services/AppServicesProvider';
import { useClientConfigStore } from '../services/stores';

/** Route names inside `app/courses/(tabs)/`. */
export type CoursesTabName =
    'index' | 'live-sessions' | 'school-calendar' | 'account';

interface TabDefinition {
    name: CoursesTabName;
    href: string;
    label: string;
    icon: IconName;
    /** Needs the NOU Tools integration preference. */
    gated: boolean;
}

export const coursesTabs: readonly TabDefinition[] = [
    {
        name: 'index',
        href: '/courses',
        label: '我的課程',
        icon: 'briefcase',
        gated: false,
    },
    {
        name: 'live-sessions',
        href: '/courses/live-sessions',
        label: '視訊面授',
        icon: 'video-camera',
        gated: true,
    },
    {
        name: 'school-calendar',
        href: '/courses/school-calendar',
        label: '學校行事曆',
        icon: 'calendar-days',
        gated: true,
    },
    {
        name: 'account',
        href: '/courses/account',
        label: '我的帳號',
        icon: 'user-circle',
        gated: false,
    },
];

interface TabButtonProps {
    tab: TabDefinition;
    isFocused?: boolean;
    onPress?: () => void;
    nouToolsEnabled: boolean;
    onGatedPress: () => void;
}

/** One tab of the bar (legacy CoursesBottomNav item). */
function TabButton({
    tab,
    isFocused = false,
    onPress,
    nouToolsEnabled,
    onGatedPress,
}: TabButtonProps) {
    const blocked = tab.gated && !nouToolsEnabled;

    return (
        <Pressable
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isFocused }}
            onPress={blocked ? onGatedPress : onPress}
            className={`flex-1 items-center gap-1 rounded-xl px-2 py-2 ${
                isFocused
                    ? 'bg-theme-800 dark:bg-zinc-600'
                    : 'active:bg-theme-50 dark:active:bg-zinc-800'
            }`}
        >
            <Icon
                name={tab.icon}
                size={24}
                className={
                    isFocused
                        ? 'text-white'
                        : 'text-theme-700 dark:text-zinc-300'
                }
            />
            <Text
                numberOfLines={2}
                className={`text-center text-xs font-semibold leading-tight ${
                    isFocused
                        ? 'text-white'
                        : 'text-theme-700 dark:text-zinc-300'
                }`}
            >
                {tab.label}
            </Text>
        </Pressable>
    );
}

/**
 * Prompt shown when a gated tab is tapped while the NOU Tools integration is
 * off (legacy 「開啟 NOU 小幫手整合」 modal).
 */
export function NouToolsEnableDialog({
    visible,
    onClose,
    onEnable,
    error,
    enabling,
}: {
    visible: boolean;
    onClose: () => void;
    onEnable: () => void;
    error: string | null;
    enabling: boolean;
}) {
    return (
        <Sheet visible={visible} onClose={onClose} placement="center">
            <View className="p-6">
                <Text className="mb-2 text-lg font-semibold text-theme-900 dark:text-white">
                    開啟 NOU 小幫手整合
                </Text>
                <Text className="mb-6 text-sm text-theme-700 dark:text-zinc-300">
                    此功能需要開啟 NOU 小幫手整合才可使用。
                </Text>
                {error ? (
                    <Text className="mb-4 text-sm text-rose-600 dark:text-rose-400">
                        {error}
                    </Text>
                ) : null}
                <View className="flex-row gap-3">
                    <Button
                        className="flex-1"
                        label="取消"
                        variant="secondary"
                        onPress={onClose}
                    />
                    <Button
                        className="flex-1"
                        label="開啟"
                        loading={enabling}
                        onPress={onEnable}
                    />
                </View>
            </View>
        </Sheet>
    );
}

/**
 * Bottom tabs of the main screen: courses, live sessions, school calendar and
 * account. Render it from `app/courses/(tabs)/_layout.tsx`; the route files
 * `index`, `live-sessions`, `school-calendar` and `account` sit beside it.
 */
export function CoursesTabs() {
    const runtime = useServiceRuntime();
    const insets = useSafeAreaInsets();
    const nouToolsEnabled = useClientConfigStore(
        (state) => state.preferences.nouToolsIntegrationEnabled,
    );
    const [dialogOpen, setDialogOpen] = useState(false);
    const [enabling, setEnabling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const enableNouTools = async () => {
        setEnabling(true);
        setError(null);

        try {
            await runtime.updatePreferences({
                nouToolsIntegrationEnabled: true,
            });
            setDialogOpen(false);
        } catch {
            setError('啟用失敗，請稍後重試');
        } finally {
            setEnabling(false);
        }
    };

    return (
        <Tabs>
            <TabSlot />
            <TabList asChild>
                <View
                    className="flex-row gap-2 border-t border-theme-200 bg-white px-4 pt-2 dark:border-zinc-700 dark:bg-zinc-900"
                    style={{ paddingBottom: Math.max(insets.bottom, 12) }}
                >
                    {coursesTabs.map((tab) => (
                        <TabTrigger
                            key={tab.name}
                            name={tab.name}
                            href={tab.href as never}
                            asChild
                        >
                            <TabButton
                                tab={tab}
                                nouToolsEnabled={nouToolsEnabled}
                                onGatedPress={() => setDialogOpen(true)}
                            />
                        </TabTrigger>
                    ))}
                </View>
            </TabList>
            <NouToolsEnableDialog
                visible={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onEnable={() => void enableNouTools()}
                error={error}
                enabling={enabling}
            />
        </Tabs>
    );
}
