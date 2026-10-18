import type { SchoolPortalGrade } from '@altuu/core';
import { Text } from '@altuu/ui';
import { useMemo } from 'react';
import { View } from 'react-native';

import { useServiceQuery } from '../../services/useServiceQuery';
import { ErrorRetry } from '../../shell/ErrorRetry';
import { SubPage } from '../components/SubPage';
import { Card } from '../components/primitives';
import { LoadingCard, EmptyCard } from '../components/states';

interface SemesterGroup {
  semesterLabel: string;
  grades: SchoolPortalGrade[];
}

export function groupBySemester(grades: SchoolPortalGrade[]): SemesterGroup[] {
  const groups: SemesterGroup[] = [];

  for (const grade of grades) {
    const last = groups[groups.length - 1];

    if (last && last.semesterLabel === grade.semesterLabel) {
      last.grades.push(grade);
    } else {
      groups.push({
        semesterLabel: grade.semesterLabel,
        grades: [grade],
      });
    }
  }

  return groups;
}

export function isScorePassing(score: string | null): boolean {
  if (score === null) {
    return false;
  }

  const numeric = parseInt(score, 10);

  return !Number.isNaN(numeric) && numeric >= 60;
}

function labelled(
  items: Array<{ label: string; value: string | null }>,
): Array<{ label: string; value: string }> {
  return items.filter(
    (item): item is { label: string; value: string } => item.value !== null,
  );
}

function DetailRow({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View className="mt-1 flex-row flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => (
        <View key={item.label} className="flex-row items-center gap-1">
          <Text className="text-xs text-theme-700 dark:text-zinc-400">
            {item.label}
          </Text>
          <Text className="text-xs font-medium text-theme-900 dark:text-zinc-200">
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SemesterGrade({ value }: { value: string | null }) {
  if (value === null || value === '') {
    return (
      <View className="rounded bg-theme-100 px-2.5 py-1 dark:bg-zinc-800">
        <Text className="text-lg font-semibold text-theme-700 dark:text-zinc-400">
          —
        </Text>
      </View>
    );
  }

  const passing = isScorePassing(value);

  return (
    <View
      className={`rounded px-2.5 py-1 ${
        passing
          ? 'bg-emerald-100 dark:bg-emerald-900/50'
          : 'bg-red-100 dark:bg-red-900/50'
      }`}
    >
      <Text
        accessibilityLabel={`學期成績 ${value}`}
        className={`text-lg font-semibold ${
          passing
            ? 'text-emerald-800 dark:text-emerald-200'
            : 'text-red-800 dark:text-red-200'
        }`}
      >
        {value}
      </Text>
    </View>
  );
}

/** Legacy Account/Grades.vue. */
export function GradesScreen() {
  const grades = useServiceQuery<SchoolPortalGrade[]>({
    op: 'schoolPortal.grades',
    queryKey: ['account', 'grades'],
    queryFn: (services) => services.schoolPortalDomain.getAllCourseGrades(),
    staleTime: 0,
  });
  const groups = useMemo(
    () => groupBySemester(grades.data ?? []),
    [grades.data],
  );

  return (
    <SubPage title="我的成績" backHref="/courses/account">
      {grades.isPending ? (
        <LoadingCard>載入成績中…</LoadingCard>
      ) : grades.error ? (
        <ErrorRetry
          error={grades.error}
          retrying={grades.isFetching}
          onRetry={() => void grades.refetch()}
        />
      ) : groups.length === 0 ? (
        <EmptyCard>查無成績資料。</EmptyCard>
      ) : (
        groups.map((group) => (
          <View key={group.semesterLabel} className="gap-2">
            <Text className="px-1 text-sm font-semibold text-theme-700 dark:text-zinc-400">
              {group.semesterLabel}
            </Text>
            {group.grades.map((grade, index) => (
              <Card key={`${group.semesterLabel}-${index}`}>
                <View className="flex-row items-center justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-base font-medium text-theme-900 dark:text-zinc-100">
                      {grade.courseName}
                    </Text>
                    <View className="mt-2">
                      <DetailRow
                        items={labelled([
                          {
                            label: '學分數',
                            value: grade.credits,
                          },
                        ])}
                      />
                    </View>
                    <DetailRow
                      items={labelled([
                        {
                          label: '平時成績',
                          value: grade.regularAverage,
                        },
                        {
                          label: '期中成績',
                          value: grade.midtermScore,
                        },
                        {
                          label: '期末成績',
                          value: grade.finalScore,
                        },
                      ])}
                    />
                  </View>
                  <SemesterGrade value={grade.semesterGrade} />
                </View>
              </Card>
            ))}
          </View>
        ))
      )}
    </SubPage>
  );
}
