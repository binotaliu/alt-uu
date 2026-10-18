import { Text, Icon } from '@altuu/ui';
import { Pressable, View } from 'react-native';

import type { ServiceError } from '../services/serviceError';
import { ErrorRetry } from '../shell/ErrorRetry';
import {
  Card,
  EmptyNotice,
  SegmentedControl,
  Skeleton,
} from './components/primitives';
import {
  formatMonthDay,
  formatSessionClock,
  formatUtcOffset,
  formatWeekday,
  groupSessionsByMonth,
  resolveTimeZone,
  splitTeacherName,
  type DisplayTimezone,
  type FlattenedLiveSession,
} from './liveSessions';

const accountScopeOptions = [
  { value: false, label: '目前帳號' },
  { value: true, label: '所有帳號' },
] as const;

const timezoneOptions = [
  { value: 'taiwan', label: '台灣時區' },
  { value: 'local', label: '我的時區' },
] as const;

export interface LiveSessionsViewProps {
  sessions: readonly FlattenedLiveSession[];
  isLoading: boolean;
  error: ServiceError | null;
  retrying?: boolean;
  onRetry: () => void;
  hasMultipleAccounts: boolean;
  showAllAccounts: boolean;
  onShowAllAccountsChange: (value: boolean) => void;
  displayTimezone: DisplayTimezone;
  onDisplayTimezoneChange: (value: DisplayTimezone) => void;
  savingTimezone: boolean;
  systemTimeZone: string;
  systemOffsetMinutes: number;
  onEnterClassroom: (url: string, session: FlattenedLiveSession) => void;
}

function SessionCard({
  session,
  timeZone,
  displayTimezone,
  showAccountLabel,
  onEnterClassroom,
}: {
  session: FlattenedLiveSession;
  timeZone: string;
  displayTimezone: DisplayTimezone;
  showAccountLabel: boolean;
  onEnterClassroom: LiveSessionsViewProps['onEnterClassroom'];
}) {
  const teacher = splitTeacherName(session.teacherName);
  const clock = { displayTimezone, timeZone };

  return (
    <Card>
      <View className="flex-row items-start gap-3">
        <View className="w-20 shrink-0 items-center gap-1">
          {showAccountLabel && session.accountLabel ? (
            <View className="max-w-full rounded-full bg-theme-100 px-2 py-0.5 dark:bg-zinc-800">
              <Text
                numberOfLines={1}
                className="text-[10px] font-medium text-theme-800 dark:text-zinc-400"
              >
                {session.accountLabel}
              </Text>
            </View>
          ) : null}
          <View className="w-full items-center rounded-lg bg-theme-100 px-2 py-2 dark:bg-zinc-800">
            <Text className="text-lg font-bold text-theme-700 dark:text-zinc-200">
              {formatMonthDay(session.startAt, session.date, timeZone)}
            </Text>
            <Text className="mt-0.5 text-base text-theme-700 dark:text-zinc-400">
              {formatWeekday(session.startAt, timeZone)}
            </Text>
          </View>
        </View>

        <View className="min-w-0 flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text
              numberOfLines={1}
              className="min-w-0 flex-1 text-sm font-semibold text-theme-900 dark:text-zinc-100"
            >
              {session.courseName}
            </Text>
            {session.status !== 'upcoming' ? (
              <View
                className={`shrink-0 rounded-full px-2.5 py-1 ${
                  session.status === 'ongoing'
                    ? 'bg-emerald-100 dark:bg-emerald-900/50'
                    : 'bg-zinc-200 dark:bg-zinc-700'
                }`}
              >
                <Text
                  className={`text-[11px] font-semibold ${
                    session.status === 'ongoing'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {session.status === 'ongoing' ? '進行中' : '已結束'}
                </Text>
              </View>
            ) : null}
          </View>
          <Text className="mt-1 text-xs text-theme-700 dark:text-zinc-400">
            {session.className || '未提供班級名稱'}・
            {session.typeLabel || '未知班別'}
          </Text>
          <Text className="mt-1 text-xs text-theme-700 dark:text-zinc-400">
            {teacher.name}
            {teacher.hasTitle ? ' 老師' : ''}
          </Text>
          <Text className="mt-1 text-sm font-medium text-theme-800 dark:text-zinc-200">
            {formatSessionClock(
              session.startAt,
              session.startTime,
              session.date,
              clock,
            )}
            {' - '}
            {formatSessionClock(
              session.endAt,
              session.endTime,
              session.date,
              clock,
            )}
          </Text>
        </View>
      </View>

      {session.link || session.backupClassroomUrl ? (
        <View className="mt-3 flex-row items-center justify-end gap-3">
          {session.backupClassroomUrl ? (
            <Pressable
              accessibilityRole="link"
              accessibilityHint="主教室人數已滿時可改用此備用連結"
              onPress={() =>
                onEnterClassroom(session.backupClassroomUrl as string, session)
              }
              className="px-3 py-1"
            >
              <Text className="text-xs font-medium text-theme-700 dark:text-zinc-400">
                備用教室
              </Text>
            </Pressable>
          ) : null}
          {session.link ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => onEnterClassroom(session.link as string, session)}
              className="flex-row items-center gap-1 rounded-lg border border-theme-300 px-3 py-1.5 active:bg-theme-50 dark:border-zinc-600 dark:active:bg-zinc-800"
            >
              <Icon
                name="video-camera"
                size={20}
                className="text-theme-700 dark:text-zinc-200"
              />
              <Text className="text-base font-medium text-theme-700 dark:text-zinc-200">
                進入教室
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <View className="gap-4" accessibilityLabel="載入視訊面授中">
      {[0, 1].map((section) => (
        <View key={section} className="gap-2">
          <Skeleton className="h-5 w-32" />
          {[0, 1, 2].map((item) => (
            <Card key={item}>
              <View className="flex-row items-center gap-3">
                <Skeleton className="h-16 w-16 rounded-lg" />
                <View className="flex-1 gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </View>
              </View>
            </Card>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Live sessions grouped into 即將開始 / 進行中 and 已結束, by month. */
export function LiveSessionsView(props: LiveSessionsViewProps) {
  const {
    sessions,
    isLoading,
    error,
    retrying,
    onRetry,
    hasMultipleAccounts,
    showAllAccounts,
    displayTimezone,
    systemTimeZone,
    systemOffsetMinutes,
  } = props;
  const timeZone = resolveTimeZone(displayTimezone, systemTimeZone);
  const isSystemUtcPlus8 = systemOffsetMinutes === 8 * 60;

  const groups = [
    {
      label: '即將開始 / 進行中',
      emptyMessage: '目前沒有即將開始或進行中的視訊面授。',
      items: sessions.filter((session) => session.status !== 'ended'),
    },
    {
      label: '已結束',
      emptyMessage: '目前沒有已結束的視訊面授。',
      items: sessions.filter((session) => session.status === 'ended'),
    },
  ];

  return (
    <View className="gap-4">
      {hasMultipleAccounts ? (
        <SegmentedControl
          options={accountScopeOptions}
          value={showAllAccounts}
          onChange={props.onShowAllAccountsChange}
        />
      ) : null}

      {!isSystemUtcPlus8 ? (
        <Card>
          <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
            選擇顯示的時區
          </Text>
          <Text className="mb-3 mt-1 text-xs leading-relaxed text-theme-700 dark:text-zinc-400">
            {`系統偵測到你的時區是 ${systemTimeZone} (${formatUtcOffset(systemOffsetMinutes)})，你可以選擇本頁顯示的時區。`}
          </Text>
          <SegmentedControl
            options={timezoneOptions}
            value={displayTimezone}
            onChange={props.onDisplayTimezoneChange}
            disabled={props.savingTimezone}
          />
        </Card>
      ) : null}

      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorRetry error={error} onRetry={onRetry} retrying={retrying} />
      ) : sessions.length === 0 ? (
        <EmptyNotice>目前沒有可顯示的視訊面授班級資訊。</EmptyNotice>
      ) : (
        groups.map((group) => (
          <View key={group.label} className="gap-3">
            <View className="rounded-2xl border border-theme-200 bg-theme-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
              <Text
                accessibilityRole="header"
                className="text-sm font-semibold text-theme-900 dark:text-zinc-100"
              >
                {group.label}
              </Text>
            </View>

            {group.items.length === 0 ? (
              <EmptyNotice>{group.emptyMessage}</EmptyNotice>
            ) : (
              groupSessionsByMonth(group.items, timeZone).map((month) => (
                <View key={month.monthKey} className="gap-2">
                  <Text className="px-1 py-1 text-xs font-bold text-theme-700 dark:text-zinc-200">
                    {month.monthLabel}
                  </Text>
                  {month.items.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      timeZone={timeZone}
                      displayTimezone={displayTimezone}
                      showAccountLabel={hasMultipleAccounts && showAllAccounts}
                      onEnterClassroom={props.onEnterClassroom}
                    />
                  ))}
                </View>
              ))
            )}
          </View>
        ))
      )}
    </View>
  );
}
