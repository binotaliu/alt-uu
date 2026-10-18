import type { ActivityHeatmap as ActivityHeatmapData } from '@altuu/core';
import { Text, Icon } from '@altuu/ui';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { useServiceQuery } from '../../services/useServiceQuery';
import { buildSampleActivity } from '../lib/activity';
import { ActivityHeatmap } from './ActivityHeatmap';
import { Card, PremiumBadge, Sparkles } from './primitives';

export const ACTIVITY_QUERY_KEY = ['account', 'activity'] as const;

function Skeleton() {
  return (
    <View className="gap-4">
      <View className="gap-2">
        <View className="flex-row gap-2">
          {[0, 1].map((key) => (
            <View
              key={key}
              className="h-16 flex-1 rounded-lg border border-theme-200 bg-theme-50 dark:border-zinc-700 dark:bg-zinc-800"
            />
          ))}
        </View>
        <View className="h-16 rounded-lg border border-theme-200 bg-theme-50 dark:border-zinc-700 dark:bg-zinc-800" />
      </View>
      <View className="h-32 rounded-lg bg-theme-100 dark:bg-zinc-800" />
    </View>
  );
}

/** Legacy AccountActivityWidget: the heatmap, or a blurred sample behind an upsell. */
export function AccountActivityWidget({ subscribed }: { subscribed: boolean }) {
  const [allAccounts, setAllAccounts] = useState(false);
  const sample = useMemo(() => buildSampleActivity(), []);
  const activity = useServiceQuery<ActivityHeatmapData>({
    op: 'accounts.activity',
    queryKey: [...ACTIVITY_QUERY_KEY, allAccounts],
    queryFn: (services) => services.activity.getHeatmap({ allAccounts }),
    enabled: subscribed,
    staleTime: 0,
  });

  return (
    <Card className="overflow-hidden">
      <View className="mb-3 flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2">
          <Icon
            name="chart-bar"
            size={20}
            className="text-theme-700 dark:text-zinc-400"
          />
          <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
            學習活動
          </Text>
          {subscribed ? null : <PremiumBadge />}
        </View>

        {subscribed && activity.data?.hasMultipleAccounts ? (
          <View className="flex-row rounded-full border border-theme-200 bg-theme-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
            {(
              [
                [false, '目前帳號'],
                [true, '所有帳號'],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityState={{
                  selected: allAccounts === value,
                }}
                onPress={() => setAllAccounts(value)}
                className={`rounded-full px-3 py-1 ${
                  allAccounts === value ? 'bg-white dark:bg-zinc-700' : ''
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    allAccounts === value
                      ? 'text-theme-900 dark:text-zinc-100'
                      : 'text-theme-700 dark:text-zinc-400'
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {subscribed ? (
        activity.data ? (
          <ActivityHeatmap {...activity.data} />
        ) : activity.isError ? (
          <Text className="text-sm text-theme-700 dark:text-zinc-400">
            無法載入學習活動資料。
          </Text>
        ) : (
          <Skeleton />
        )
      ) : (
        <View>
          <View pointerEvents="none" className="opacity-60">
            <ActivityHeatmap {...sample} />
          </View>
          <View className="bg-theme-900/80 absolute right-0 top-0 rounded-full px-2 py-0.5 dark:bg-zinc-100/80">
            <Text className="text-[10px] font-medium text-theme-50 dark:text-zinc-900">
              範例資料
            </Text>
          </View>
          <View className="mt-3 items-center gap-2 rounded-xl bg-white/90 p-4 dark:bg-zinc-900/90">
            <Sparkles />
            <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
              學習活動為 Alt UU+ 專屬功能
            </Text>
            <Text className="text-center text-xs text-theme-700 dark:text-zinc-400">
              追蹤你的學習連續天數與每日學習時間，如上方範例所示。訂閱即可解鎖你的真實學習紀錄。
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/courses/account/subscription')}
              className="rounded-lg bg-theme-700 px-3 py-1.5 active:bg-theme-800 dark:bg-theme-800"
            >
              <Text className="text-sm font-medium text-theme-50">升級</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Card>
  );
}
