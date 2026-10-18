import type {
  BoardListViewModel,
  CourseHomeworkItem,
  CourseHomeworkList,
  CourseItem,
  CourseLastSeenMaterial,
  CourseLearningTimeItem,
  CourseSchoolPortalInfo,
  CourseTasksCount,
  LiveSessionItem,
  NouToolsCourseInfo,
  SchoolPortalGrade,
} from '@altuu/core';

import { discussQueryKeys } from '../discuss/queryKeys';
import { useServiceQuery } from '../services/useServiceQuery';
import { indexTasksCount } from './format';

/**
 * Query keys of the course area; the first element is `courses` / `nouTools`,
 * except the discuss boards, which use the discuss area's key.
 */
export const courseKeys = {
  list: ['courses', 'list'] as const,
  tasksCount: ['courses', 'tasksCount'] as const,
  learningTimes: (cid: string) => ['courses', cid, 'learningTimes'] as const,
  lastSeen: (cid: string) => ['courses', cid, 'lastSeen'] as const,
  homeworks: (cid: string) => ['courses', cid, 'homeworks'] as const,
  selfExams: (cid: string) => ['courses', cid, 'selfExams'] as const,
  grade: (cid: string) => ['courses', cid, 'grade'] as const,
  schoolPortalInfo: (cid: string) =>
    ['courses', cid, 'schoolPortalInfo'] as const,
  nouToolsInfo: (cid: string) => ['nouTools', 'courseInfo', cid] as const,
  /** Shared with the discuss screens, whose reads invalidate the unread badges. */
  boards: (cid: string) => discussQueryKeys.boards(cid),
  liveSessions: (allAccounts: boolean) =>
    ['nouTools', 'liveSessions', allAccounts] as const,
  schoolCalendar: ['nouTools', 'schoolCalendar'] as const,
};

/** The active account's courses (legacy courses store; cached by TanStack Query). */
export function useCourses() {
  return useServiceQuery<CourseItem[]>({
    op: 'courses.list',
    queryKey: courseKeys.list,
    queryFn: (services) => services.course.listCourses(),
  });
}

/** Pending homeworks and unread articles per course id (never cached for long). */
export function useCourseTasksCount() {
  return useServiceQuery<Record<string, CourseTasksCount>>({
    op: 'courses.tasksCount',
    queryKey: courseKeys.tasksCount,
    queryFn: async (services) =>
      indexTasksCount(await services.course.getTasksCount()),
    staleTime: 0,
  });
}

export function useCourseLearningTimes(cid: string) {
  return useServiceQuery<CourseLearningTimeItem[]>({
    op: 'courses.learningTimes',
    queryKey: courseKeys.learningTimes(cid),
    queryFn: (services) => services.course.getLearningTimes(cid),
  });
}

/** Failures are swallowed like legacy: the "last seen" label is optional. */
export function useLastSeenMaterial(cid: string) {
  return useServiceQuery<CourseLastSeenMaterial | null>({
    op: 'courses.lastSeenMaterial',
    queryKey: courseKeys.lastSeen(cid),
    queryFn: async (services) => {
      try {
        return await services.course.getLastSeenMaterial(cid);
      } catch {
        return null;
      }
    },
  });
}

export function useCourseHomeworks(cid: string, enabled: boolean) {
  return useServiceQuery<CourseHomeworkList>({
    op: 'courses.homeworks',
    queryKey: courseKeys.homeworks(cid),
    queryFn: (services) => services.course.getHomeworks(cid),
    enabled,
    staleTime: 0,
  });
}

export function useCourseSelfExams(cid: string, enabled: boolean) {
  return useServiceQuery<CourseHomeworkItem[]>({
    op: 'courses.selfExams',
    queryKey: courseKeys.selfExams(cid),
    queryFn: (services) => services.course.getSelfExams(cid),
    enabled,
    staleTime: 0,
  });
}

export function useCourseGrade(cid: string, enabled: boolean) {
  return useServiceQuery<SchoolPortalGrade | null>({
    op: 'courses.grade',
    queryKey: courseKeys.grade(cid),
    queryFn: (services) => services.schoolPortalDomain.getCourseGrade(cid),
    enabled,
  });
}

export function useCourseSchoolPortalInfo(cid: string, enabled: boolean) {
  return useServiceQuery<CourseSchoolPortalInfo>({
    op: 'courses.schoolPortalInfo',
    queryKey: courseKeys.schoolPortalInfo(cid),
    queryFn: (services) =>
      services.schoolPortalDomain.getCourseSchoolPortalInfo(cid),
    enabled,
  });
}

export function useNouToolsCourseInfo(cid: string, enabled: boolean) {
  return useServiceQuery<NouToolsCourseInfo>({
    op: 'nouTools.courseInfo',
    queryKey: courseKeys.nouToolsInfo(cid),
    queryFn: (services) => services.nouTools.courseInfo(cid),
    enabled,
  });
}

export function useCourseBoards(cid: string | null) {
  return useServiceQuery<BoardListViewModel>({
    op: 'discuss.boards',
    queryKey: courseKeys.boards(cid ?? ''),
    queryFn: (services) => services.discuss.listBoards(cid as string),
    enabled: cid !== null,
    staleTime: 0,
  });
}

export function useLiveSessions(allAccounts: boolean) {
  return useServiceQuery<LiveSessionItem[]>({
    op: 'nouTools.liveSessions',
    queryKey: courseKeys.liveSessions(allAccounts),
    queryFn: (services) => services.nouTools.liveSessions({ allAccounts }),
    staleTime: 0,
  });
}

export interface SchoolCalendarEvent {
  name: string;
  startDate: string;
  endDate: string;
  isCountdown: boolean;
}

export function useSchoolCalendar() {
  return useServiceQuery<SchoolCalendarEvent[]>({
    op: 'nouTools.schoolCalendar',
    queryKey: courseKeys.schoolCalendar,
    queryFn: async (services) =>
      (await services.nouTools.schoolCalendar()) as unknown as SchoolCalendarEvent[],
    staleTime: 0,
  });
}
