import type { SchoolPortalExamAgendaItem } from '@altuu/core';
import { Text } from '@altuu/ui';
import { useMemo } from 'react';
import { View } from 'react-native';

import { useServiceQuery } from '../../services/useServiceQuery';
import { ErrorRetry } from '../../shell/ErrorRetry';
import { SubPage } from '../components/SubPage';
import { Card } from '../components/primitives';
import { EmptyCard, LoadingCard } from '../components/states';
import { formatSchoolPortalTimeRange } from '../lib/schoolPortalFormat';

interface ExamDateGroup {
    date: string;
    items: SchoolPortalExamAgendaItem[];
}

interface ExamGroup {
    label: string;
    dateGroups: ExamDateGroup[];
}

const GROUP_ORDER = ['期中考', '期末考'];

/** "期中考(正考)" -> "期中考": every agenda item is 正考, so the qualifier is noise. */
function groupLabel(category: string): string {
    return category.replace(/[（(][^）)]*[）)]\s*$/, '').trim() || category;
}

export function groupExamAgenda(
    items: SchoolPortalExamAgendaItem[],
): ExamGroup[] {
    const byLabel = new Map<string, SchoolPortalExamAgendaItem[]>();

    for (const item of items) {
        const label = groupLabel(item.category);
        byLabel.set(label, [...(byLabel.get(label) ?? []), item]);
    }

    const labels = [
        ...GROUP_ORDER.filter((label) => byLabel.has(label)),
        ...[...byLabel.keys()].filter((label) => !GROUP_ORDER.includes(label)),
    ];

    return labels.map((label) => {
        const byDate = new Map<string, SchoolPortalExamAgendaItem[]>();

        for (const item of byLabel.get(label) ?? []) {
            const date = item.date ?? '';
            byDate.set(date, [...(byDate.get(date) ?? []), item]);
        }

        return {
            label,
            dateGroups: [...byDate.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, groupItems]) => ({ date, items: groupItems })),
        };
    });
}

/** Legacy Account/ExamInfo.vue. */
export function ExamInfoScreen() {
    const agenda = useServiceQuery<SchoolPortalExamAgendaItem[]>({
        op: 'courses.grade',
        queryKey: ['account', 'exam-agenda'],
        queryFn: (services) => services.schoolPortalDomain.getExamAgenda(),
        staleTime: 0,
    });
    const groups = useMemo(
        () => groupExamAgenda(agenda.data ?? []),
        [agenda.data],
    );

    return (
        <SubPage title="考試資訊" backHref="/courses/account">
            {agenda.isPending ? (
                <LoadingCard>載入考試資訊中…</LoadingCard>
            ) : agenda.error ? (
                <ErrorRetry
                    error={agenda.error}
                    retrying={agenda.isFetching}
                    onRetry={() => void agenda.refetch()}
                />
            ) : groups.length === 0 ? (
                <EmptyCard>查無考試資訊。</EmptyCard>
            ) : (
                groups.map((group) => (
                    <View key={group.label} className="gap-3">
                        <Text className="px-1 text-sm font-semibold text-theme-700 dark:text-zinc-400">
                            {group.label}
                        </Text>
                        {group.dateGroups.map((dateGroup) => (
                            <View
                                key={`${group.label}-${dateGroup.date}`}
                                className="gap-2"
                            >
                                {dateGroup.date ? (
                                    <Text className="px-1 text-xs font-medium text-theme-600 dark:text-zinc-500">
                                        {dateGroup.date}
                                    </Text>
                                ) : null}
                                {dateGroup.items.map((item, index) => (
                                    <Card key={`${item.courseName}-${index}`}>
                                        <Text className="text-base font-medium text-theme-900 dark:text-zinc-100">
                                            {item.courseName}
                                        </Text>
                                        <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
                                            <View className="flex-row items-center gap-1">
                                                <Text className="text-xs text-theme-700 dark:text-zinc-400">
                                                    時間
                                                </Text>
                                                <Text className="text-xs font-medium text-theme-900 dark:text-zinc-200">
                                                    {formatSchoolPortalTimeRange(
                                                        item.time,
                                                    )}
                                                </Text>
                                            </View>
                                            {item.room ? (
                                                <View className="flex-row items-center gap-1">
                                                    <Text className="text-xs text-theme-700 dark:text-zinc-400">
                                                        教室
                                                    </Text>
                                                    <Text className="text-xs font-medium text-theme-900 dark:text-zinc-200">
                                                        {item.room}
                                                    </Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    </Card>
                                ))}
                            </View>
                        ))}
                    </View>
                ))
            )}
        </SubPage>
    );
}
