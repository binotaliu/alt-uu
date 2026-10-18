import type { SchoolPortalGrade } from '@altuu/core';
import { Text } from '@altuu/ui';
import { Fragment } from 'react';
import { View } from 'react-native';

import { Card, EmptyNotice, Skeleton } from '../components/primitives';
import { useCourseGrade } from '../courseQueries';
import { ErrorRetry } from '../../shell/ErrorRetry';

function ScoreRow({
    items,
}: {
    items: Array<{ label: string; value: string | null }>;
}) {
    return (
        <View className="mt-3 flex-row flex-wrap items-stretch justify-center gap-2">
            {items.map((item, index) => (
                <Fragment key={item.label}>
                    <View className="min-w-20 items-center justify-center rounded-xl border border-theme-200 px-3 py-2 dark:border-zinc-700">
                        <Text className="text-center text-xs text-theme-700 dark:text-zinc-400">
                            {item.label}
                        </Text>
                        <Text className="mt-1 text-sm font-semibold text-theme-900 dark:text-zinc-100">
                            {item.value ?? '無資料'}
                        </Text>
                    </View>
                    {index < items.length - 1 ? (
                        <Text className="self-center text-theme-700 dark:text-zinc-500">
                            +
                        </Text>
                    ) : null}
                </Fragment>
            ))}
        </View>
    );
}

/** Pure view of one school portal grade (legacy CourseGradeTab body). */
export function CourseGradeView({ grade }: { grade: SchoolPortalGrade }) {
    const isSummerSemester = grade.semesterLabel.includes('暑');
    const regularItems = [
        { label: '第一次平時', value: grade.firstRegularScore },
        { label: '第二次平時', value: grade.secondRegularScore },
        { label: '學習參與', value: grade.participationScore },
    ];
    const semesterItems = [
        { label: '平時成績', value: grade.regularAverage },
        ...(isSummerSemester
            ? []
            : [{ label: '期中成績', value: grade.midtermScore }]),
        { label: '期末成績', value: grade.finalScore },
    ];

    return (
        <View className="gap-4">
            <Card className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-theme-700 dark:text-zinc-300">
                    {grade.semesterLabel}
                </Text>
                {grade.credits ? (
                    <View className="rounded-full bg-theme-100 px-2.5 py-1 dark:bg-zinc-800">
                        <Text className="font-medium text-theme-800 dark:text-zinc-300">
                            {grade.credits} 學分
                        </Text>
                    </View>
                ) : null}
            </Card>

            <Card>
                <Text className="text-xs font-semibold text-theme-700 dark:text-zinc-400">
                    平時成績
                </Text>
                <ScoreRow items={regularItems} />
                <Text className="my-2 text-center text-theme-700 dark:text-zinc-500">
                    ↓
                </Text>
                <View className="items-center rounded-xl bg-theme-100 px-3 py-2 dark:bg-zinc-800">
                    <Text className="text-xs text-theme-700 dark:text-zinc-400">
                        平時成績
                    </Text>
                    <Text className="mt-1 text-base font-semibold text-theme-900 dark:text-zinc-100">
                        {grade.regularAverage ?? '無資料'}
                    </Text>
                </View>
            </Card>

            <Card>
                <Text className="text-xs font-semibold text-theme-700 dark:text-zinc-400">
                    學期成績
                </Text>
                <ScoreRow items={semesterItems} />
                <Text className="my-2 text-center text-theme-700 dark:text-zinc-500">
                    ↓
                </Text>
                <View className="items-center rounded-xl bg-emerald-100 px-3 py-2.5 dark:bg-emerald-900/50">
                    <Text className="text-xs text-emerald-700 dark:text-emerald-300">
                        學期成績
                    </Text>
                    <Text className="mt-1 text-xl font-bold text-emerald-800 dark:text-emerald-200">
                        {grade.semesterGrade ?? '無資料'}
                    </Text>
                </View>
            </Card>
        </View>
    );
}

/** 成績: the school portal grade of this course for the current semester. */
export function CourseGradeTab({ cid }: { cid: string }) {
    const grade = useCourseGrade(cid, true);

    if (grade.isPending) {
        return (
            <Card accessibilityLabel="載入成績中">
                {[0, 1, 2, 3, 4].map((row) => (
                    <Skeleton key={row} className="mb-3 h-5 w-2/5" />
                ))}
            </Card>
        );
    }

    if (grade.isError) {
        return (
            <ErrorRetry
                error={grade.error}
                retrying={grade.isFetching}
                onRetry={() => void grade.refetch()}
            />
        );
    }

    if (!grade.data) {
        return <EmptyNotice>本學期查無此課程的教務系統成績資料。</EmptyNotice>;
    }

    return <CourseGradeView grade={grade.data} />;
}
