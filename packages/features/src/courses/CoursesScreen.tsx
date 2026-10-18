import { useCallback } from 'react';

import { useShowWhatsNewOnUpgrade } from '../shell/useWhatsNew';
import { CourseListView } from './CourseListView';
import { TabScreenFrame } from './components/TabScreenFrame';
import { useCourses, useCourseTasksCount } from './courseQueries';

/**
 * 我的課程 tab (legacy MainScreen + CoursesPane). Also the screen that shows
 * the What's new sheet after an upgrade.
 */
export function CoursesScreen() {
    useShowWhatsNewOnUpgrade();

    const courses = useCourses();
    const tasks = useCourseTasksCount();
    const { refetch: refetchCourses } = courses;
    const { refetch: refetchTasks } = tasks;

    // The course list is cheap (cached); task counts are always re-read.
    const refresh = useCallback(() => {
        void refetchCourses();
        void refetchTasks();
    }, [refetchCourses, refetchTasks]);

    return (
        <TabScreenFrame
            title="我的課程"
            icon="briefcase"
            path="/courses"
            showStatusBanners
            refreshing={courses.isRefetching || tasks.isRefetching}
            onRefresh={refresh}
        >
            <CourseListView
                courses={courses.data ?? []}
                tasksCount={tasks.data ?? {}}
                tasksLoading={tasks.isFetching}
                tasksError={tasks.isError}
                isLoading={courses.isPending}
                error={courses.isError ? courses.error : null}
                retrying={courses.isFetching}
                onRetry={() => void refetchCourses()}
            />
        </TabScreenFrame>
    );
}
