import type { ActivityHeatmap as ActivityHeatmapData } from '@altuu/core';
import { Text, Icon, useIsDark } from '@altuu/ui';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

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

/** Legacy `bg-gradient-to-t from-white via-white/95 to-transparent`. */
function FadeToSurface() {
  const surface = useIsDark() ? '#18181b' : '#ffffff';

  return (
    <View pointerEvents="none" className="absolute inset-0">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="fade" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={surface} stopOpacity="1" />
            <Stop offset="0.5" stopColor={surface} stopOpacity="0.95" />
            <Stop offset="1" stopColor={surface} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#fade)" />
      </Svg>
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
    <Card className="relative overflow-hidden">
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
        <>
          <View pointerEvents="none">
            <ActivityHeatmap {...sample} />
          </View>
          <View className="-mx-4 -mb-4 -mt-24 items-center gap-2 overflow-hidden rounded-b-2xl p-4 pt-10">
            <FadeToSurface />
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
          <View
            pointerEvents="none"
            className="absolute right-3 top-3 rounded-full bg-theme-700 px-2 py-0.5 dark:bg-zinc-300"
          >
            <Text className="text-[10px] font-medium text-white dark:text-zinc-900">
              範例資料
            </Text>
          </View>
        </>
      )}
    </Card>
  );
}
