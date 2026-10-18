import type { ActivityDay } from '@altuu/core';
import { Text } from '@altuu/ui';
import { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  type ScrollViewInstance,
} from 'react-native';

import {
  WEEKDAY_LABELS,
  buildWeeks,
  cellTitle,
  currentStreakStartDate,
  formatDateSlash,
  formatDuration,
  levelFor,
  longestStreakRange,
  monthLabelFor,
  type HeatmapCell,
} from '../lib/activity';

export interface ActivityHeatmapProps {
  days: ActivityDay[];
  currentStreak: number;
  longestStreak: number;
  longestStudyDaySeconds: number;
  longestStudyDayDate: string | null;
}

const LEVEL_CLASSES = [
  'bg-theme-100 dark:bg-zinc-800',
  'bg-theme-200 dark:bg-theme-900',
  'bg-theme-300 dark:bg-theme-800',
  'bg-theme-500 dark:bg-theme-600',
  'bg-theme-700 dark:bg-theme-400',
] as const;

const CELL = 12;
const GAP = 4;

function StatBox({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`flex-row items-center justify-between gap-2 rounded-lg border border-theme-200 bg-theme-50 p-3 dark:border-zinc-700 dark:bg-zinc-800 ${className}`}
    >
      <Text className="text-xs leading-tight text-theme-700 dark:text-zinc-400">
        {label}
      </Text>
      <View className="items-end">{children}</View>
    </View>
  );
}

function WeekdayColumn() {
  return (
    <View style={{ gap: GAP, paddingTop: CELL + GAP }}>
      {WEEKDAY_LABELS.map((label, index) => (
        <View key={index} style={{ height: CELL, justifyContent: 'center' }}>
          <Text className="text-[10px] leading-3 text-theme-700 dark:text-zinc-400">
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Legacy ActivityHeatmap: streak stats plus the six-month grid. */
export function ActivityHeatmap({
  days,
  currentStreak,
  longestStreak,
  longestStudyDaySeconds,
  longestStudyDayDate,
}: ActivityHeatmapProps) {
  const weeks = useMemo(() => buildWeeks(days), [days]);
  const streakStart = currentStreakStartDate(days, currentStreak);
  const longestRange = longestStreakRange(days, longestStreak);
  const [selected, setSelected] = useState<HeatmapCell>(null);
  const scroller = useRef<ScrollViewInstance>(null);

  return (
    <View className="gap-4">
      <View className="gap-2">
        <View className="flex-row gap-2">
          <StatBox label={'目前\n連續'} className="flex-1">
            <Text className="text-xl font-semibold text-theme-900 dark:text-zinc-100">
              {currentStreak}
              <Text className="text-xs text-theme-700 dark:text-zinc-400">
                {' 天'}
              </Text>
            </Text>
            <Text className="text-xs text-theme-700 dark:text-zinc-400">
              {streakStart ? `${formatDateSlash(streakStart)} ~` : '—'}
            </Text>
          </StatBox>
          <StatBox label={'最長\n連續'} className="flex-1">
            <Text className="text-xl font-semibold text-theme-900 dark:text-zinc-100">
              {longestStreak}
              <Text className="text-xs text-theme-700 dark:text-zinc-400">
                {' 天'}
              </Text>
            </Text>
            <Text className="text-xs text-theme-700 dark:text-zinc-400">
              {longestRange
                ? longestRange.start === longestRange.end
                  ? formatDateSlash(longestRange.start)
                  : `${formatDateSlash(longestRange.start)}\n~ ${formatDateSlash(longestRange.end)}`
                : '—'}
            </Text>
          </StatBox>
        </View>
        <StatBox label={'最長\n單日學習時間'}>
          <Text className="text-xl font-semibold text-theme-900 dark:text-zinc-100">
            {longestStudyDaySeconds > 0
              ? formatDuration(longestStudyDaySeconds)
              : '—'}
          </Text>
          <Text className="text-xs text-theme-700 dark:text-zinc-400">
            {longestStudyDayDate ? formatDateSlash(longestStudyDayDate) : ''}
          </Text>
        </StatBox>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() =>
          scroller.current?.scrollToEnd({ animated: false })
        }
        contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
      >
        <WeekdayColumn />
        <View style={{ flexDirection: 'row', gap: GAP }}>
          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={{ gap: GAP }}>
              <View style={{ height: CELL, width: CELL }}>
                <Text
                  numberOfLines={1}
                  className="w-10 text-[10px] leading-3 text-theme-700 dark:text-zinc-400"
                >
                  {monthLabelFor(weeks, weekIndex)}
                </Text>
              </View>
              {week.map((cell, dayIndex) =>
                cell ? (
                  <Pressable
                    key={dayIndex}
                    accessibilityLabel={cellTitle(cell)}
                    onPress={() =>
                      setSelected(selected?.date === cell.date ? null : cell)
                    }
                    style={{ width: CELL, height: CELL }}
                    className={`rounded-sm ${LEVEL_CLASSES[levelFor(cell.seconds)]}`}
                  />
                ) : (
                  <View key={dayIndex} style={{ width: CELL, height: CELL }} />
                ),
              )}
            </View>
          ))}
        </View>
        <WeekdayColumn />
      </ScrollView>

      {selected ? (
        <Text className="text-xs text-theme-700 dark:text-zinc-400">
          {cellTitle(selected)}
        </Text>
      ) : null}
    </View>
  );
}
