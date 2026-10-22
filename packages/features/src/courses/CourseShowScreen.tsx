import {
  FoldSplit,
  Icon,
  PageHeader,
  Screen,
  Text,
  useDuoLayout,
  useIsTablet,
  type IconName,
} from '@altuu/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { discussQueryKeys } from '../discuss/queryKeys';
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

const courseTabs: ReadonlyArray<{
  id: CourseTab;
  label: string;
  /** Label and icon of the tablet sidebar entry. */
  sidebarLabel: string;
  icon: IconName;
}> = [
  { id: 'materials', label: '教材', sidebarLabel: '教材目錄', icon: 'folder' },
  {
    id: 'discuss',
    label: '討論',
    sidebarLabel: '討論板',
    icon: 'chat-bubble-left-right',
  },
  {
    id: 'homework',
    label: '作業',
    sidebarLabel: '作業',
    icon: 'clipboard-document-list',
  },
  {
    id: 'self-exam',
    label: '練習',
    sidebarLabel: '自我練習',
    icon: 'clipboard-document-check',
  },
  { id: 'grades', label: '成績', sidebarLabel: '成績', icon: 'chart-bar' },
  {
    id: 'course-info',
    label: '課程資訊',
    sidebarLabel: '課程資訊',
    icon: 'information-circle',
  },
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
  const isTablet = useIsTablet();
  const { foldFrame, foldAxis } = useDuoLayout();
  const { bottom: bottomInset } = useSafeAreaInsets();
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
    // Returning from a material page: show the latest learning progress.
    if (here && !wasHere.current) {
      void queryClient.invalidateQueries({
        queryKey: courseKeys.learningTimes(cid),
      });
      void queryClient.invalidateQueries({
        queryKey: courseKeys.lastSeen(cid),
      });
    }

    // Returning from a discuss board: refresh the unread badge and the boards'
    // 新文章 markers.
    if (here && !wasHere.current) {
      void queryClient.invalidateQueries({ queryKey: courseKeys.tasksCount });
      void queryClient.invalidateQueries({
        queryKey: [...discussQueryKeys.all, 'boards'],
      });
    }

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

  const [refreshingMaterials, setRefreshingMaterials] = useState(false);

  const refreshMaterials = async () => {
    setRefreshingMaterials(true);

    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: courseKeys.learningTimes(cid) }),
        queryClient.refetchQueries({ queryKey: courseKeys.lastSeen(cid) }),
      ]);
    } finally {
      setRefreshingMaterials(false);
    }
  };

  const markOpenedInBrowser = () => {
    refreshOnReturn.current = true;
  };

  const badgeFor = (tab: CourseTab): number =>
    tab === 'discuss'
      ? courseTasks.unreadArticles
      : tab === 'homework'
        ? courseTasks.pendingHomeworks
        : 0;

  const sidebar = (
    <View
      className={`${foldFrame ? 'w-full' : 'w-56'} gap-1 self-start rounded-2xl border border-theme-200 bg-white/90 p-1 dark:border-zinc-700 dark:bg-zinc-900/90`}
    >
      {courseTabs.map((tab) => {
        const selected = tab.id === activeTab;
        const badge = badgeFor(tab.id);

        return (
          <Pressable
            key={tab.id}
            testID={`course-tab-${tab.id}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => setActiveTab(tab.id)}
            className={`flex-row items-center justify-between rounded-xl px-3 py-2 ${
              selected
                ? 'bg-theme-800 dark:bg-zinc-600'
                : 'active:bg-theme-50 dark:active:bg-zinc-800'
            }`}
          >
            <View className="flex-row items-center gap-1">
              <Icon
                name={tab.icon}
                size={16}
                className={
                  selected ? 'text-white' : 'text-theme-700 dark:text-zinc-300'
                }
              />
              <Text
                className={`font-medium ${
                  selected ? 'text-white' : 'text-theme-700 dark:text-zinc-300'
                }`}
              >
                {tab.sidebarLabel}
              </Text>
            </View>
            <TabBadge count={badge} active={selected} />
          </Pressable>
        );
      })}
    </View>
  );

  const materialsBody = (
    // The directory scrolls itself, so it runs down to the bottom inset
    // instead of leaving the body scroll's `pb-24` gap under the card.
    <View
      className={`flex-1 ${isTablet ? '' : 'px-3'}`}
      style={{ paddingBottom: bottomInset + 12 }}
    >
      <CourseMaterialsTab
        cid={cid}
        refreshControl={
          <RefreshControl
            refreshing={refreshingMaterials}
            onRefresh={() => void refreshMaterials()}
          />
        }
      />
    </View>
  );

  // The materials tab scrolls itself so its folder rows can stick.
  const otherBodyScroll = (
    <ScrollView
      testID="course-body-scroll"
      className="flex-1"
      contentContainerClassName={isTablet ? 'pb-6' : 'px-3 pb-24'}
      keyboardShouldPersistTaps="handled"
    >
      {activeTab === 'discuss' ? (
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
  );

  const bodyScroll =
    activeTab === 'materials' ? materialsBody : otherBodyScroll;

  const header = (
    <PageHeader
      title={course?.name || `課程 ${cid}`}
      isLoading={courses.isPending}
      backHref="/courses"
      below={
        course && (course.semester || course.courseType || course.className) ? (
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
  );

  // Folded iPhone Duo: nothing interactive may cross the hinge, so the course navigation
  // and the body become two panes either side of it; the header bar spans the window and
  // keeps its content off the fold. Book posture (vertical fold): tabs left, body right.
  // Tabletop posture (horizontal fold): body above, tabs below, since the lower half is
  // the one to reach with a thumb.
  if (foldFrame) {
    const horizontal = foldAxis === 'horizontal';
    const tabList = (
      <ScrollView testID="course-fold-tabs" contentContainerClassName="p-3">
        {sidebar}
      </ScrollView>
    );
    const body = <View className="min-h-0 flex-1 px-3 pt-3">{bodyScroll}</View>;

    return (
      <Screen ignoreTopInset ignoreBottomInset>
        {header}
        <FoldSplit
          first={horizontal ? body : tabList}
          second={horizontal ? tabList : body}
        />
      </Screen>
    );
  }

  return (
    <Screen ignoreTopInset ignoreBottomInset>
      {header}

      {isTablet ? (
        <View className="mx-auto w-full max-w-6xl flex-1 flex-row gap-4 px-4 pt-4">
          {sidebar}
          <View className="min-w-0 flex-1">{bodyScroll}</View>
        </View>
      ) : (
        <>
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

          {bodyScroll}
        </>
      )}
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
