import { Text } from '@altuu/ui';
import { useMemo } from 'react';
import { View } from 'react-native';

import { ErrorRetry } from '../shell/ErrorRetry';
import { Card, EmptyNotice, Skeleton } from './components/primitives';
import { TabScreenFrame } from './components/TabScreenFrame';
import { useSchoolCalendar, type SchoolCalendarEvent } from './courseQueries';
import type { ServiceError } from '../services/serviceError';
import {
    groupEventsByMonth,
    pickCountdownEvent,
    presentCalendar,
    type EventPresentation,
} from './schoolCalendar';

function StatusPill({ status }: { status: 'ongoing' | 'ended' }) {
    return (
        <View
            className={`rounded-full px-2.5 py-1 ${
                status === 'ongoing'
                    ? 'bg-emerald-100 dark:bg-emerald-900/50'
                    : 'bg-zinc-200 dark:bg-zinc-700'
            }`}
        >
            <Text
                className={`text-[11px] font-semibold ${
                    status === 'ongoing'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-zinc-700 dark:text-zinc-300'
                }`}
            >
                {status === 'ongoing' ? '進行中' : '已結束'}
            </Text>
        </View>
    );
}

export interface SchoolCalendarViewProps {
    events: readonly SchoolCalendarEvent[];
    isLoading: boolean;
    error: ServiceError | null;
    retrying?: boolean;
    onRetry: () => void;
    now?: Date;
}

/** Countdown card plus 即將開始 / 進行中 and 已結束 events grouped by month. */
export function SchoolCalendarView({
    events,
    isLoading,
    error,
    retrying,
    onRetry,
    now,
}: SchoolCalendarViewProps) {
    const presented = useMemo(
        () => presentCalendar(events, now ?? new Date()),
        [events, now],
    );

    if (isLoading) {
        return (
            <View className="gap-4" accessibilityLabel="載入學校行事曆中">
                <Card>
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="mt-3 h-3 w-36" />
                </Card>
                {[0, 1, 2, 3, 4, 5].map((item) => (
                    <Card key={item}>
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="mt-2 h-3 w-1/2" />
                    </Card>
                ))}
            </View>
        );
    }

    if (error) {
        return (
            <ErrorRetry error={error} onRetry={onRetry} retrying={retrying} />
        );
    }

    if (presented.length === 0) {
        return <EmptyNotice>目前沒有可顯示的學校行事曆。</EmptyNotice>;
    }

    const countdown = pickCountdownEvent(presented);
    const timeline = presented.filter(
        (event) =>
            !(
                countdown &&
                event.name === countdown.name &&
                event.startDate === countdown.startDate &&
                event.endDate === countdown.endDate
            ),
    );
    const groups: Array<{
        label: string;
        emptyMessage: string;
        events: EventPresentation[];
    }> = [
        {
            label: '即將開始 / 進行中',
            emptyMessage: '目前沒有即將開始或進行中的活動。',
            events: timeline.filter((event) => event.status !== 'ended'),
        },
        {
            label: '已結束',
            emptyMessage: '目前沒有已結束的活動。',
            events: timeline.filter((event) => event.status === 'ended'),
        },
    ];

    return (
        <View className="gap-4">
            {countdown ? (
                <View className="flex-row items-center justify-between rounded-2xl border border-theme-200 bg-theme-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
                    <View className="min-w-0 flex-1 gap-1">
                        <Text className="text-base font-semibold text-theme-900 dark:text-zinc-100">
                            {countdown.name}
                        </Text>
                        <Text className="text-sm text-theme-700 dark:text-zinc-300">
                            {countdown.rangeLabel}
                        </Text>
                    </View>
                    {countdown.status === 'ongoing' ? (
                        <StatusPill status="ongoing" />
                    ) : (
                        <View className="items-end">
                            <Text className="text-2xl font-bold text-theme-800 dark:text-zinc-100">
                                {Math.max(countdown.daysUntil, 0)}
                            </Text>
                            <Text className="text-xs text-theme-700 dark:text-zinc-400">
                                天後
                            </Text>
                        </View>
                    )}
                </View>
            ) : null}

            {groups.map((group) => (
                <View key={group.label} className="gap-3">
                    <View className="rounded-2xl border border-theme-200 bg-theme-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
                        <Text
                            accessibilityRole="header"
                            className="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                        >
                            {group.label}
                        </Text>
                    </View>

                    {group.events.length === 0 ? (
                        <EmptyNotice>{group.emptyMessage}</EmptyNotice>
                    ) : (
                        groupEventsByMonth(group.events).map((month) => (
                            <View key={month.monthKey} className="gap-2">
                                <Text className="px-1 py-1 text-xs font-bold text-theme-700 dark:text-zinc-200">
                                    {month.monthLabel}
                                </Text>
                                {month.events.map((event) => (
                                    <Card
                                        key={`${event.name}-${event.startDate}-${event.endDate}`}
                                    >
                                        <View className="flex-row items-start justify-between gap-3">
                                            <View className="min-w-0 flex-1">
                                                <Text
                                                    numberOfLines={2}
                                                    className="text-sm font-semibold text-theme-900 dark:text-zinc-100"
                                                >
                                                    {event.name}
                                                </Text>
                                                <Text className="mt-1 text-sm text-theme-700 dark:text-zinc-300">
                                                    {event.rangeLabel}
                                                </Text>
                                            </View>
                                            {event.status !== 'upcoming' ? (
                                                <StatusPill
                                                    status={event.status}
                                                />
                                            ) : null}
                                        </View>
                                    </Card>
                                ))}
                            </View>
                        ))
                    )}
                </View>
            ))}
        </View>
    );
}

/** 學校行事曆 tab (legacy SchoolCalendarPane + SchoolCalendarTab). */
export function SchoolCalendarScreen() {
    const calendar = useSchoolCalendar();
    const { refetch } = calendar;

    return (
        <TabScreenFrame
            title="學校行事曆"
            icon="calendar-days"
            path="/courses/school-calendar"
            refreshing={calendar.isRefetching}
            onRefresh={() => void refetch()}
        >
            <SchoolCalendarView
                events={calendar.data ?? []}
                isLoading={calendar.isPending}
                error={calendar.isError ? calendar.error : null}
                retrying={calendar.isFetching}
                onRetry={() => void refetch()}
            />
        </TabScreenFrame>
    );
}
