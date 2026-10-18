import { PageHeader, Screen, Text } from '@altuu/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { CourseChips } from './CourseListView';
import { courseKeys, useCourses, useCourseTasksCount } from './courseQueries';
import { courseTasksFor, formatBadgeCount } from './format';
import { CourseDiscussTab } from './tabs/CourseDiscussTab';
import { CourseGradeTab } from './tabs/CourseGradeTab';
import { CourseHomeworkTab } from './tabs/CourseHomeworkTab';
import { CourseInfoTab } from './tabs/CourseInfoTab';
import { CourseMaterialsTab } from './tabs/CourseMaterialsTab';
import { CourseSelfExamTab } from './tabs/CourseSelfExamTab';

export type CourseTab =
  'materials' | 'discuss' | 'homework' | 'self-exam' | 'grades' | 'course-info';

const courseTabs: ReadonlyArray<{ id: CourseTab; label: string }> = [
  { id: 'materials', label: '教材' },
  { id: 'discuss', label: '討論' },
  { id: 'homework', label: '作業' },
  { id: 'self-exam', label: '練習' },
  { id: 'grades', label: '成績' },
  { id: 'course-info', label: '課程資訊' },
];

/** Reads the `tab` route param (legacy `#hash` / `tab` prop). */
export function resolveCourseTab(value: string | undefined): CourseTab {
  return courseTabs.some((tab) => tab.id === value)
    ? (value as CourseTab)
    : 'materials';
}

function TabBadge({ count, active }: { count: number; active: boolean }) {
  if (count <= 0) {
    return null;
  }

  return (
    <View
      className={`-my-1 ml-2 h-5 w-8 items-center justify-center rounded-full ${
        active ? 'bg-white dark:bg-zinc-900' : 'bg-theme-800 dark:bg-zinc-600'
      }`}
    >
      <Text
        className={`text-xs font-semibold leading-4 ${
          active ? 'text-theme-800 dark:text-white' : 'text-white'
        }`}
      >
        {formatBadgeCount(count)}
      </Text>
    </View>
  );
}

export interface CourseShowViewProps {
  cid: string;
  initialTab?: CourseTab;
}

/** Course detail with the 教材 / 討論 / 作業 / 練習 / 成績 / 課程資訊 tabs. */
export function CourseShowView({
  cid,
  initialTab = 'materials',
}: CourseShowViewProps) {
  const [activeTab, setActiveTab] = useState<CourseTab>(initialTab);
  const [routeTab, setRouteTab] = useState<CourseTab>(initialTab);

  // A `?tab=` change on an already mounted screen (e.g. the discuss board's
  // back link replacing the route) selects that tab.
  if (routeTab !== initialTab) {
    setRouteTab(initialTab);
    setActiveTab(initialTab);
  }
  const courses = useCourses();
  const tasks = useCourseTasksCount();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const refreshOnReturn = useRef(false);
  const wasHere = useRef(true);
  const here = pathname === `/courses/${encodeURIComponent(cid)}`;

  const course = courses.data?.find((item) => item.courseId === cid) ?? null;
  const courseTasks = course
    ? courseTasksFor(course, tasks.data ?? {})
    : { courseId: cid, pendingHomeworks: 0, unreadArticles: 0 };

  // Returning from the in-app browser refreshes the list that opened it.
  useEffect(() => {
    if (here && !wasHere.current && refreshOnReturn.current) {
      refreshOnReturn.current = false;
      void queryClient.invalidateQueries({
        queryKey:
          activeTab === 'self-exam'
            ? courseKeys.selfExams(cid)
            : courseKeys.homeworks(cid),
      });
    }

    wasHere.current = here;
  }, [here, activeTab, cid, queryClient]);

  const markOpenedInBrowser = () => {
    refreshOnReturn.current = true;
  };

  const badgeFor = (tab: CourseTab): number =>
    tab === 'discuss'
      ? courseTasks.unreadArticles
      : tab === 'homework'
        ? courseTasks.pendingHomeworks
        : 0;

  return (
    <Screen ignoreTopInset ignoreBottomInset>
      <PageHeader
        title={course?.name || `課程 ${cid}`}
        isLoading={courses.isPending}
        backHref="/courses"
        below={
          course &&
          (course.semester || course.courseType || course.className) ? (
            <View className="flex-row items-center">
              {course.semester ? (
                <Text className="mr-2 shrink-0 text-sm font-medium text-theme-700 dark:text-zinc-300">
                  {course.semester}
                </Text>
              ) : null}
              <CourseChips
                courseType={course.courseType}
                className={course.className}
              />
            </View>
          ) : null
        }
      />

      <View className="py-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-3 min-w-full justify-center"
        >
          <View className="flex-row rounded-2xl border border-theme-200 bg-white/90 p-1 dark:border-zinc-700 dark:bg-zinc-900/90">
            {courseTabs.map((tab) => {
              const selected = tab.id === activeTab;

              return (
                <Pressable
                  key={tab.id}
                  testID={`course-tab-${tab.id}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setActiveTab(tab.id)}
                  className={`min-w-24 shrink-0 flex-row items-center justify-center rounded-xl px-4 py-2 ${
                    selected
                      ? 'bg-theme-800 dark:bg-zinc-600'
                      : 'active:bg-theme-50 dark:active:bg-zinc-800'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      selected
                        ? 'text-white'
                        : 'text-theme-700 dark:text-zinc-300'
                    }`}
                  >
                    {tab.label}
                  </Text>
                  <TabBadge count={badgeFor(tab.id)} active={selected} />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-3 pb-24"
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === 'materials' ? (
          <CourseMaterialsTab cid={cid} />
        ) : activeTab === 'discuss' ? (
          <CourseDiscussTab
            cid={cid}
            className={course?.className ?? null}
            commonCourseId={course?.commonCourseId ?? null}
          />
        ) : activeTab === 'homework' ? (
          <CourseHomeworkTab
            cid={cid}
            onOpenedInAppBrowser={markOpenedInBrowser}
          />
        ) : activeTab === 'self-exam' ? (
          <CourseSelfExamTab
            cid={cid}
            onOpenedInAppBrowser={markOpenedInBrowser}
          />
        ) : activeTab === 'grades' ? (
          <CourseGradeTab cid={cid} />
        ) : (
          <CourseInfoTab cid={cid} />
        )}
      </ScrollView>
    </Screen>
  );
}

/** Route screen for `/courses/[cid]` (optional `?tab=`). */
export function CourseShowScreen() {
  const { cid, tab } = useLocalSearchParams<{ cid: string; tab?: string }>();

  return (
    <CourseShowView
      key={cid}
      cid={String(cid)}
      initialTab={resolveCourseTab(tab)}
    />
  );
}
