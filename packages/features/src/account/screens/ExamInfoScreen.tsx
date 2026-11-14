import type {
  SchoolPortalCourseExamScopes,
  SchoolPortalExamAgendaItem,
} from '@altuu/core';
import { Text } from '@altuu/ui';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  AccountScopeSwitch,
  AccountLabel,
  EmptyNotice,
} from '../../courses/components/primitives';
import { ErrorRetry } from '../../shell/ErrorRetry';
import { SubPage } from '../components/SubPage';
import { Card } from '../components/primitives';
import { EmptyCard, LoadingCard } from '../components/states';
import {
  useExamAgenda,
  useExamScopes,
  useHasMultipleAccounts,
} from '../hooks/useSchoolPortalQueries';
import { ExamScopeEntries } from '../../courses/components/ExamScopeEntries';
import { formatSchoolPortalTimeRange } from '../../courses/format';

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
        // Stable: same-time exams keep their account order.
        .map(([date, groupItems]) => ({
          date,
          items: [...groupItems].sort((a, b) =>
            (a.time ?? '').localeCompare(b.time ?? ''),
          ),
        })),
    };
  });
}

/**
 * 命題範圍 for one exam group. Scope categories read "期中考試範圍" while agenda
 * groups read "期中考", so match on the group label as a prefix. In an
 * all-accounts list `accountId` keeps two accounts' same-named courses apart.
 */
export function findExamScopes(
  scopesByCourse: SchoolPortalCourseExamScopes[],
  courseName: string,
  groupLabelText: string,
  accountId?: number,
): string[] {
  const course = scopesByCourse.find(
    (item) =>
      item.courseName === courseName &&
      (accountId === undefined || item.accountId === accountId),
  );

  return (course?.scopes ?? [])
    .filter((scope) => scope.category.startsWith(groupLabelText))
    .map((scope) => scope.scope?.trim() ?? '')
    .filter((scope) => scope !== '');
}

/** Exam end as an instant; portal dates and times are Taiwan local time. */
export function examEndsAt(item: SchoolPortalExamAgendaItem): Date | null {
  const date = item.date?.match(/^(\d+)年(\d+)月(\d+)日/u);
  const time = item.time?.match(/^\d{4}~(\d{2})(\d{2})/);

  if (!date || !time) {
    return null;
  }

  const pad = (value: string) => value.padStart(2, '0');
  const parsed = new Date(
    `${date[1]}-${pad(date[2])}-${pad(date[3])}T${time[1]}:${time[2]}:00+08:00`,
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export interface ExamSection {
  label: string;
  emptyMessage: string;
  items: SchoolPortalExamAgendaItem[];
}

/**
 * Like the school calendar: 即將開始 / 進行中 first, 已結束 at the bottom.
 * An exam with no parsable end time counts as upcoming.
 */
export function splitExamsByStatus(
  items: SchoolPortalExamAgendaItem[],
  now: Date,
): ExamSection[] {
  const isEnded = (item: SchoolPortalExamAgendaItem) => {
    const endsAt = examEndsAt(item);

    return endsAt !== null && endsAt < now;
  };

  return [
    {
      label: '即將開始 / 進行中',
      emptyMessage: '目前沒有即將開始或進行中的考試。',
      items: items.filter((item) => !isEnded(item)),
    },
    {
      label: '已結束',
      emptyMessage: '目前沒有已結束的考試。',
      items: items.filter(isEnded),
    },
  ];
}

/** Legacy Account/ExamInfo.vue. */
export function ExamInfoScreen() {
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const hasMultipleAccounts = useHasMultipleAccounts();
  const allAccounts = hasMultipleAccounts && showAllAccounts;
  const agenda = useExamAgenda(allAccounts);
  // Scopes are supplementary: a failure here must not hide the schedule.
  const scopes = useExamScopes(allAccounts);
  // Statuses only matter when data changes (same as the school calendar).
  const sections = useMemo(
    () =>
      splitExamsByStatus(agenda.data ?? [], new Date()).map((section) => ({
        ...section,
        groups: groupExamAgenda(section.items),
      })),
    [agenda.data],
  );

  return (
    <SubPage title="考試資訊" backHref="/courses/account">
      {hasMultipleAccounts ? (
        <AccountScopeSwitch
          showAllAccounts={showAllAccounts}
          onChange={setShowAllAccounts}
        />
      ) : null}
      {agenda.isPending ? (
        <LoadingCard>載入考試資訊中…</LoadingCard>
      ) : agenda.error ? (
        <ErrorRetry
          error={agenda.error}
          retrying={agenda.isFetching}
          onRetry={() => void agenda.refetch()}
        />
      ) : (agenda.data ?? []).length === 0 ? (
        <EmptyCard>查無考試資訊。</EmptyCard>
      ) : (
        sections.map((section) => (
          <View key={section.label} className="gap-4">
            <View className="rounded-2xl border border-theme-200 bg-theme-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
              <Text
                accessibilityRole="header"
                className="text-sm font-semibold text-theme-900 dark:text-zinc-100"
              >
                {section.label}
              </Text>
            </View>
            {section.groups.length === 0 ? (
              <EmptyNotice>{section.emptyMessage}</EmptyNotice>
            ) : null}
            {section.groups.map((group) => (
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
                    {dateGroup.items.map((item, index) => {
                      const examScopes = findExamScopes(
                        scopes.data ?? [],
                        item.courseName,
                        group.label,
                        item.accountId,
                      );

                      return (
                        <Card key={`${item.courseName}-${index}`}>
                          {allAccounts && item.accountLabel ? (
                            <AccountLabel label={item.accountLabel} />
                          ) : null}
                          <Text className="text-base font-medium text-theme-900 dark:text-zinc-100">
                            {item.courseName}
                          </Text>
                          <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
                            <View className="flex-row items-center gap-1">
                              <Text className="text-xs text-theme-700 dark:text-zinc-400">
                                時間
                              </Text>
                              <Text className="text-xs font-medium text-theme-900 dark:text-zinc-200">
                                {formatSchoolPortalTimeRange(item.time)}
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
                            {item.campus ? (
                              <View className="flex-row items-center gap-1">
                                <Text className="text-xs text-theme-700 dark:text-zinc-400">
                                  校區
                                </Text>
                                <Text className="text-xs font-medium text-theme-900 dark:text-zinc-200">
                                  {item.campus}
                                </Text>
                              </View>
                            ) : null}
                            {item.address ? (
                              <View className="flex-row items-center gap-1">
                                <Text className="text-xs text-theme-700 dark:text-zinc-400">
                                  地址
                                </Text>
                                <Text className="text-xs font-medium text-theme-900 dark:text-zinc-200">
                                  {item.address}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          {examScopes.length > 0 ? (
                            <View className="mt-2 gap-1 border-t border-theme-200 pt-2 dark:border-zinc-700">
                              <Text className="text-xs text-theme-700 dark:text-zinc-400">
                                命題範圍
                              </Text>
                              <ExamScopeEntries scopes={examScopes} />
                            </View>
                          ) : null}
                        </Card>
                      );
                    })}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))
      )}
    </SubPage>
  );
}
