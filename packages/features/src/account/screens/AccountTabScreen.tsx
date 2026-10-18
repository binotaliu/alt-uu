import { Screen, Text, TransparentPageHeader } from '@altuu/ui';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useAppPreferences } from '../../services/hooks';
import { useClientConfigStore } from '../../services/stores';
import {
    AccountActivityWidget,
    ACTIVITY_QUERY_KEY,
} from '../components/AccountActivityWidget';
import { AccountIcon } from '../components/AccountIcon';
import { Avatar, Card, Sparkles } from '../components/primitives';
import {
    formatExpiry,
    useSubscriptionStatus,
} from '../hooks/useSubscriptionStatus';

function LinkRow({
    label,
    href,
    bordered = false,
}: {
    label: string;
    href: string;
    bordered?: boolean;
}) {
    return (
        <Pressable
            accessibilityRole="link"
            onPress={() => router.push(href)}
            className={`flex-row items-center justify-between gap-2 px-4 py-3 active:bg-theme-50 dark:active:bg-zinc-800 ${
                bordered ? 'border-t border-theme-200 dark:border-zinc-700' : ''
            }`}
        >
            <Text className="text-sm font-medium text-theme-900 dark:text-zinc-100">
                {label}
            </Text>
            <AccountIcon
                name="chevron-right"
                size={16}
                className="text-theme-700 dark:text-zinc-500"
            />
        </Pressable>
    );
}

/** Legacy Courses/panes/AccountPane.vue plus its tab header (route `courses/(tabs)/account`). */
export function AccountTabScreen() {
    const profile = useClientConfigStore((state) => state.profile);
    const { altUuPlusDisabled } = useAppPreferences();
    const queryClient = useQueryClient();
    const subscription = useSubscriptionStatus({ refreshOnMount: false });
    const { refresh } = subscription;
    const hasFocusedOnce = useRef(false);

    // Tabs stay mounted, so refresh the entitlement and heatmap each time the
    // tab is shown again (legacy onActivated).
    useFocusEffect(
        useCallback(() => {
            void refresh();

            if (hasFocusedOnce.current) {
                void queryClient.invalidateQueries({
                    queryKey: ACTIVITY_QUERY_KEY,
                });
            }

            hasFocusedOnce.current = true;
        }, [refresh, queryClient]),
    );

    return (
        <Screen ignoreTopInset ignoreBottomInset>
            <TransparentPageHeader
                title="我的帳號"
                icon={
                    <AccountIcon
                        name="user-circle"
                        size={20}
                        className="text-theme-900 dark:text-zinc-100"
                    />
                }
                actions={
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push('/settings')}
                        className="flex-row items-center gap-1 rounded-full border border-theme-300 bg-white px-3 py-1.5 active:bg-theme-50 dark:border-zinc-600 dark:bg-zinc-800 dark:active:bg-zinc-700"
                    >
                        <AccountIcon
                            name="cog-6-tooth"
                            size={16}
                            className="text-theme-700 dark:text-zinc-300"
                        />
                        <Text className="text-sm font-medium text-theme-700 dark:text-zinc-300">
                            設定
                        </Text>
                    </Pressable>
                }
            />

            <ScrollView contentContainerClassName="mx-auto w-full max-w-2xl gap-4 px-4 pb-6 pt-3">
                <Card>
                    <View className="flex-row items-center gap-4">
                        <Avatar picture={profile?.picture} size={56} />
                        <View className="min-w-0 flex-1">
                            <Text className="text-lg font-semibold text-theme-900 dark:text-zinc-100">
                                {profile?.displayName ?? '學生'}
                            </Text>
                            {profile?.username ? (
                                <Text className="text-sm text-theme-700 dark:text-zinc-400">
                                    {profile.username}
                                </Text>
                            ) : null}
                        </View>
                        <Pressable
                            accessibilityRole="link"
                            onPress={() =>
                                router.push('/courses/account/accounts')
                            }
                            className="flex-row items-center gap-1 rounded-lg px-2 py-1 active:bg-theme-50 dark:active:bg-zinc-800"
                        >
                            <Text className="text-sm font-medium text-theme-700 dark:text-zinc-400">
                                切換帳號
                            </Text>
                            <AccountIcon
                                name="chevron-down"
                                size={16}
                                className="text-theme-700 dark:text-zinc-400"
                            />
                        </Pressable>
                    </View>
                </Card>

                <View className="overflow-hidden rounded-xl border border-theme-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                    <LinkRow label="我的成績" href="/courses/account/grades" />
                    <LinkRow
                        label="考試資訊"
                        href="/courses/account/exam-info"
                        bordered
                    />
                </View>

                {altUuPlusDisabled ? null : (
                    <>
                        <Card>
                            <View className="flex-row items-center justify-between gap-4">
                                <View className="min-w-0 flex-1 flex-row items-center gap-3">
                                    <Sparkles />
                                    <View className="min-w-0 flex-1">
                                        <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
                                            Alt UU+
                                        </Text>
                                        <Text className="text-xs text-theme-700 dark:text-zinc-400">
                                            {subscription.active
                                                ? `已訂閱${
                                                      subscription.entitlement
                                                          ?.expiresAt
                                                          ? `・下次續訂 ${formatExpiry(subscription.entitlement.expiresAt)}`
                                                          : ''
                                                  }`
                                                : '解鎖主題色、學習統計等更多功能'}
                                        </Text>
                                    </View>
                                </View>
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={() =>
                                        router.push(
                                            '/courses/account/subscription',
                                        )
                                    }
                                    className="rounded-lg bg-theme-700 px-3 py-1.5 active:bg-theme-800 dark:bg-theme-800"
                                >
                                    <Text className="text-sm font-medium text-theme-50">
                                        {subscription.active
                                            ? '檢視方案'
                                            : '升級'}
                                    </Text>
                                </Pressable>
                            </View>
                        </Card>

                        <AccountActivityWidget
                            subscribed={subscription.active}
                        />

                        <Card>
                            <View className="flex-row items-center justify-between gap-4">
                                <View className="min-w-0 flex-1 flex-row items-center gap-3">
                                    <AccountIcon
                                        name="arrows-right-left"
                                        size={24}
                                        className="text-theme-700 dark:text-zinc-400"
                                    />
                                    <View className="min-w-0 flex-1">
                                        <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
                                            匯入/匯出資料
                                        </Text>
                                        <Text className="text-xs text-theme-700 dark:text-zinc-400">
                                            備份學習紀錄，或轉移到其他裝置
                                        </Text>
                                    </View>
                                </View>
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={() =>
                                        router.push(
                                            '/courses/account/data-export',
                                        )
                                    }
                                    className="rounded-lg border border-theme-300 bg-theme-50 px-3 py-1.5 active:bg-theme-100 dark:border-zinc-600 dark:bg-zinc-800"
                                >
                                    <Text className="text-sm font-medium text-theme-800 dark:text-zinc-100">
                                        進行
                                    </Text>
                                </Pressable>
                            </View>
                        </Card>
                    </>
                )}
            </ScrollView>
        </Screen>
    );
}
