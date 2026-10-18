import { UserFacingHttpError, type CourseItem } from '@altuu/core';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import {
  ACTIVE_MATERIAL_SESSION_KEY,
  type ActiveMaterialSession,
} from '../material/activeMaterialSession';
import { resetActiveMaterialRestoreForTests } from '../material/ActiveMaterialRestorePrompt';
import { CoursesScreen } from './CoursesScreen';
import { renderWithServices } from './testUtils';

const course = (
  courseId: string,
  overrides: Partial<CourseItem> = {},
): CourseItem => ({
  courseId,
  commonCourseId: null,
  semester: '114-1',
  name: `課程 ${courseId} 名稱`,
  className: null,
  courseType: null,
  ...overrides,
});

const baseOverrides = (
  courses: () => Promise<CourseItem[]>,
  tasks: Array<{
    courseId: string;
    pendingHomeworks: number;
    unreadArticles: number;
  }> = [],
) => ({
  course: {
    listCourses: jest.fn(courses),
    getTasksCount: jest.fn(async () => tasks),
  },
  appStatus: {
    get: jest.fn(async () => ({ update: null, announcements: [] })),
  },
});

beforeEach(() => {
  resetActiveMaterialRestoreForTests();
  (router.push as jest.Mock).mockClear();
});

describe('CoursesScreen', () => {
  it('offers to go back to the material that was playing when the app was killed', async () => {
    const now = new Date().toISOString();
    const session: ActiveMaterialSession = {
      accountId: 1,
      routePath: '/courses/10/s1',
      cid: '10',
      activityId: 's1',
      href: 'https://uu.example/learn/s1.html',
      startedAt: now,
      lastActiveAt: now,
      positionSeconds: 30,
      mediaDurationSeconds: 600,
      wasPlaying: true,
      materialName: '第一講',
      courseName: '微積分',
    };
    const store = new Map([
      [ACTIVE_MATERIAL_SESSION_KEY, JSON.stringify(session)],
    ]);

    await renderWithServices(<CoursesScreen />, {
      ...baseOverrides(async () => [course('10')]),
      storage: {
        activeProfile: { get: async () => 1 },
        keyValues: {
          get: async (key: string) => store.get(key) ?? null,
          set: async (key: string, value: string) => {
            store.set(key, value);
          },
          delete: async (key: string) => {
            store.delete(key);
          },
        },
      },
      studyTime: { record: jest.fn(async () => undefined) },
    });

    expect(await screen.findByText('回到上次播放的教材？')).toBeTruthy();
    expect(store.has(ACTIVE_MATERIAL_SESSION_KEY)).toBe(false);

    await fireEvent.press(screen.getByText('返回教材'));

    expect(router.push).toHaveBeenCalledWith('/courses/10/s1');
  });

  it('groups courses by semester and shows task badges incl. the common course', async () => {
    await renderWithServices(
      <CoursesScreen />,
      baseOverrides(
        async () => [
          course('1', {
            commonCourseId: 'c1',
            courseType: '必修',
            className: 'A班',
          }),
          course('2', { semester: '113-2', name: '老課程' }),
          course('3', { semester: null, name: '其他課程' }),
        ],
        [
          { courseId: '1', pendingHomeworks: 1, unreadArticles: 0 },
          {
            courseId: 'c1',
            pendingHomeworks: 2,
            unreadArticles: 120,
          },
        ],
      ),
    );

    expect(await screen.findByText('課程 1 名稱')).toBeTruthy();
    expect(screen.getByText('114-1')).toBeTruthy();
    expect(screen.getByText('113-2')).toBeTruthy();
    expect(screen.getByText('其他')).toBeTruthy();
    expect(screen.getByText('必修')).toBeTruthy();
    expect(screen.getByText('A班')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByLabelText('未繳作業 3')).toBeTruthy(),
    );
    expect(screen.getByText('99+')).toBeTruthy();
    expect(screen.getAllByText('無待辦')).toHaveLength(2);
  });

  it('opens the course on press', async () => {
    await renderWithServices(
      <CoursesScreen />,
      baseOverrides(async () => [course('42', { name: '資料結構' })]),
    );

    await fireEvent.press(await screen.findByText('資料結構'));

    expect(router.push).toHaveBeenCalledWith('/courses/42');
  });

  it('shows the empty state', async () => {
    await renderWithServices(
      <CoursesScreen />,
      baseOverrides(async () => []),
    );

    expect(
      await screen.findByText(
        '您的帳號目前未有課程，期待下學期與您在課堂上見面',
      ),
    ).toBeTruthy();
  });

  it('shows the error panel and retries', async () => {
    const overrides = baseOverrides(async () => []);
    overrides.course.listCourses
      .mockRejectedValueOnce(new UserFacingHttpError(500, '學校系統忙碌'))
      .mockResolvedValueOnce([course('7', { name: '重試後課程' })]);

    await renderWithServices(<CoursesScreen />, overrides);

    expect(await screen.findByText(/學校系統忙碌/)).toBeTruthy();
    await fireEvent.press(screen.getByText('重試'));
    expect(await screen.findByText('重試後課程')).toBeTruthy();
  });

  it('marks task counts as unavailable when they fail to load', async () => {
    const overrides = baseOverrides(async () => [course('1')]);
    overrides.course.getTasksCount.mockRejectedValue(new Error('boom'));

    await renderWithServices(<CoursesScreen />, overrides);

    expect(await screen.findByText('取得待辦失敗')).toBeTruthy();
  });
});
