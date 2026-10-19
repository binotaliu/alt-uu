import type { CourseItem, CourseTasksCount } from '@altuu/core';
import { Text, Icon, useIsTablet } from '@altuu/ui';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ErrorRetry } from '../shell/ErrorRetry';
import type { ServiceError } from '../services/serviceError';
import { CardGrid, Skeleton } from './components/primitives';
import {
  courseTasksFor,
  formatBadgeCount,
  groupCoursesBySemester,
} from './format';

export interface CourseListViewProps {
  courses: readonly CourseItem[];
  tasksCount: Readonly<Record<string, CourseTasksCount>>;
  tasksLoading: boolean;
  tasksError: boolean;
  isLoading: boolean;
  error: ServiceError | null;
  retrying?: boolean;
  onRetry: () => void;
}

/** Course type + class name pill pair (legacy chip row). */
export function CourseChips({
  courseType,
  className,
}: Pick<CourseItem, 'courseType' | 'className'>) {
  return (
    <View className="min-w-0 shrink flex-row items-stretch">
      {courseType ? (
        <View
          className={`shrink-0 justify-center rounded-full bg-theme-100 px-2 py-0.5 dark:bg-theme-900 ${className ? 'rounded-r-none pr-1' : ''}`}
        >
          <Text className="text-xs font-medium text-theme-800 dark:text-zinc-300">
            {courseType}
          </Text>
        </View>
      ) : null}
      {className ? (
        <View
          className={`min-w-0 shrink justify-center bg-slate-100 px-2 py-0.5 dark:bg-zinc-700 ${courseType ? 'rounded-l-none rounded-r-full pl-1' : 'rounded-full'}`}
        >
          <Text
            numberOfLines={1}
            className="text-xs font-medium text-slate-600 dark:text-zinc-300"
          >
            {className}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function TaskBadges({
  tasks,
  loading,
  failed,
}: {
  tasks: CourseTasksCount;
  loading: boolean;
  failed: boolean;
}) {
  if (failed && !loading) {
    return (
      <Text className="text-xs text-slate-500 dark:text-zinc-400">
        取得待辦失敗
      </Text>
    );
  }

  if (loading) {
    return <Skeleton className="h-5 w-14" />;
  }

  if (tasks.pendingHomeworks === 0 && tasks.unreadArticles === 0) {
    return (
      <Text className="text-xs text-slate-600 dark:text-zinc-400">無待辦</Text>
    );
  }

  return (
    <View className="flex-row items-center gap-2">
      {tasks.pendingHomeworks > 0 ? (
        <View className="flex-row items-center gap-0.5 rounded-full border border-rose-700 px-2 py-0.5 dark:border-red-400">
          <Icon
            name="clipboard-document-list"
            size={12}
            className="text-rose-700 dark:text-red-400"
          />
          <Text
            accessibilityLabel={`未繳作業 ${tasks.pendingHomeworks}`}
            className="text-xs font-medium text-rose-700 dark:text-red-400"
          >
            {tasks.pendingHomeworks}
          </Text>
        </View>
      ) : null}
      {tasks.unreadArticles > 0 ? (
        <View className="flex-row items-center gap-0.5 rounded-full border border-yellow-800 px-2 py-0.5 dark:border-yellow-300">
          <Icon
            name="chat-bubble-left-right"
            size={12}
            className="text-yellow-800 dark:text-yellow-300"
          />
          <Text
            accessibilityLabel={`未讀文章 ${tasks.unreadArticles}`}
            className="text-xs font-medium text-yellow-800 dark:text-yellow-300"
          >
            {formatBadgeCount(tasks.unreadArticles)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function CourseCard({
  course,
  tasks,
  tasksLoading,
  tasksError,
}: {
  course: CourseItem;
  tasks: CourseTasksCount;
  tasksLoading: boolean;
  tasksError: boolean;
}) {
  const isTablet = useIsTablet();

  return (
    <Pressable
      testID="course-row"
      accessibilityRole="link"
      accessibilityLabel={course.name || `課程 ${course.courseId}`}
      onPress={() =>
        router.push(`/courses/${encodeURIComponent(course.courseId)}`)
      }
      className={`rounded-xl border border-theme-200 bg-white active:bg-theme-50 dark:border-zinc-700 dark:bg-zinc-900 dark:active:bg-zinc-800 ${isTablet ? 'gap-2 px-8 py-6' : 'gap-1 px-4 py-3'}`}
    >
      <View className="-ml-2 flex-row items-start justify-between gap-2">
        <CourseChips
          courseType={course.courseType}
          className={course.className}
        />
        <View className="min-h-5 shrink-0 justify-center">
          <TaskBadges
            tasks={tasks}
            loading={tasksLoading}
            failed={tasksError}
          />
        </View>
      </View>
      <Text
        numberOfLines={2}
        className={`font-semibold text-theme-900 dark:text-zinc-100 ${isTablet ? 'text-lg' : 'text-base'}`}
      >
        {course.name || `課程 ${course.courseId}`}
      </Text>
    </Pressable>
  );
}

function CourseListSkeleton() {
  const isTablet = useIsTablet();

  return (
    <View className="gap-6" accessibilityLabel="載入課程中">
      {[0, 1].map((group) => (
        <View key={group}>
          <Skeleton className="mb-3 h-5 w-16" />
          <CardGrid>
            {[0, 1, 2, 3, 4, 5].map((card) => (
              <View
                key={card}
                className={`rounded-xl border border-theme-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 ${isTablet ? 'gap-2 px-8 py-6' : 'gap-2 px-4 py-3'}`}
              >
                <View className="flex-row gap-2">
                  <Skeleton className="h-4 w-12 rounded-full" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </View>
                <Skeleton className={isTablet ? 'h-12 w-3/4' : 'h-10 w-3/4'} />
              </View>
            ))}
          </CardGrid>
        </View>
      ))}
    </View>
  );
}

/** Semester-grouped course cards with loading / error / empty states. */
export function CourseListView({
  courses,
  tasksCount,
  tasksLoading,
  tasksError,
  isLoading,
  error,
  retrying = false,
  onRetry,
}: CourseListViewProps) {
  if (isLoading) {
    return <CourseListSkeleton />;
  }

  if (error) {
    return <ErrorRetry error={error} onRetry={onRetry} retrying={retrying} />;
  }

  if (courses.length === 0) {
    return (
      <View className="rounded-xl border border-dashed border-theme-300 bg-theme-50 px-5 py-12 dark:border-zinc-700 dark:bg-zinc-900">
        <Text className="text-center text-theme-700 dark:text-zinc-300">
          您的帳號目前未有課程，期待下學期與您在課堂上見面
        </Text>
      </View>
    );
  }

  return (
    <CourseGroups
      courses={courses}
      tasksCount={tasksCount}
      tasksLoading={tasksLoading}
      tasksError={tasksError}
    />
  );
}

/** Legacy `grid gap-3 sm:grid-cols-2 md:gap-5 xl:grid-cols-3`. */
function CourseGroups({
  courses,
  tasksCount,
  tasksLoading,
  tasksError,
}: Pick<
  CourseListViewProps,
  'courses' | 'tasksCount' | 'tasksLoading' | 'tasksError'
>) {
  return (
    <View className="gap-6">
      {groupCoursesBySemester(courses).map((group) => (
        <View key={group.semester}>
          <Text
            accessibilityRole="header"
            className="mb-3 text-sm font-semibold text-theme-700 dark:text-zinc-300"
          >
            {group.semester}
          </Text>
          <CardGrid>
            {group.courses.map((course) => (
              <CourseCard
                key={course.courseId}
                course={course}
                tasks={courseTasksFor(course, tasksCount)}
                tasksLoading={tasksLoading}
                tasksError={tasksError}
              />
            ))}
          </CardGrid>
        </View>
      ))}
    </View>
  );
}
