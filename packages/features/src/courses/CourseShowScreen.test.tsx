import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import {
  CourseShowView,
  resolveCourseTab,
  type CourseTab,
} from './CourseShowScreen';
import { renderWithServices } from './testUtils';

jest.mock('@altuu/attachment-bridge', () =>
  jest.requireActual('@altuu/attachment-bridge/mock'),
);

const services = () => ({
  course: {
    listCourses: jest.fn(async () => [
      {
        courseId: '10',
        commonCourseId: 'c10',
        semester: '114-1',
        name: '微積分',
        className: '甲班',
        courseType: '必修',
      },
    ]),
    getTasksCount: jest.fn(async () => [
      { courseId: '10', pendingHomeworks: 2, unreadArticles: 0 },
      { courseId: 'c10', pendingHomeworks: 1, unreadArticles: 5 },
    ]),
    getLearningTimes: jest.fn(async () => [
      {
        identifier: 'F1',
        href: null,
        text: '第一章',
        level: 0,
        itemDisabled: false,
        duration: null,
      },
      {
        identifier: 'A1',
        href: 'https://uu.nou.edu.tw/a1',
        text: '1-1 極限',
        level: 1,
        itemDisabled: false,
        duration: '0:12:00',
      },
    ]),
    getLastSeenMaterial: jest.fn(async () => ({
      activityId: 'A1',
      positionSeconds: 75,
      mediaDurationSeconds: 600,
    })),
    getHomeworks: jest.fn(async () => ({
      homeworkItems: [
        {
          title: '作業一',
          percent: '10%',
          type: 'homework',
          status: '未繳交',
          window: null,
          actionUrl: 'https://uu.nou.edu.tw/hw/1',
          resultUrl: null,
          source: 'hungu',
          isSubmitted: false,
          resultUnavailableReason: null,
        },
      ],
      schoolPortalNotices: [],
    })),
    getSelfExams: jest.fn(async () => []),
  },
  discuss: {
    listBoards: jest.fn(async (courseId: string) => ({
      courseId,
      boards: [
        {
          boardId: `b-${courseId}`,
          boardName: `看板 ${courseId}`,
          allowPost: true,
          hasNewPost: courseId === '10',
          subjectCount: 3,
        },
      ],
    })),
  },
  schoolPortalDomain: {
    getCourseGrade: jest.fn(async () => null),
    getCourseSchoolPortalInfo: jest.fn(async () => ({
      classSessionInfo: null,
      examInfo: null,
    })),
  },
  nouTools: { courseInfo: jest.fn(async () => ({ course: null })) },
});

describe('CourseShowView', () => {
  it('renders the header, badges and the material tree first', async () => {
    await renderWithServices(<CourseShowView cid="10" />, services());

    expect(await screen.findByText('微積分')).toBeTruthy();
    expect(screen.getByText('114-1')).toBeTruthy();
    expect(screen.getByText('甲班')).toBeTruthy();
    expect(await screen.findByText('第一章')).toBeTruthy();
    // Folder row + synthetic link row are not generated for href-less nodes.
    expect(screen.getByText('1-1 極限')).toBeTruthy();
    expect(await screen.findByText('上次看到 1:15 / 10:00')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('opens a material node', async () => {
    await renderWithServices(<CourseShowView cid="10" />, services());

    await fireEvent.press(await screen.findByText('1-1 極限'));

    expect(router.push).toHaveBeenCalledWith('/courses/10/A1');
  });

  it('collapses directories', async () => {
    await renderWithServices(<CourseShowView cid="10" />, services());

    await fireEvent.press(await screen.findByText('第一章'));

    expect(screen.queryByText('1-1 極限')).toBeNull();
  });

  it('switches tabs and loads each tab lazily', async () => {
    const overrides = services();
    await renderWithServices(<CourseShowView cid="10" />, overrides);
    await screen.findByText('第一章');

    expect(overrides.course.getHomeworks).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('tab', { name: /作業/ }));
    expect(await screen.findByText('作業一')).toBeTruthy();
    expect(overrides.course.getHomeworks).toHaveBeenCalledWith('10');

    await fireEvent.press(screen.getByRole('tab', { name: /練習/ }));
    expect(await screen.findByText('目前沒有可顯示的自我練習。')).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: /成績/ }));
    expect(
      await screen.findByText('本學期查無此課程的教務系統成績資料。'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: /課程資訊/ }));
    expect(
      await screen.findByText(
        'NOU 小幫手與教務系統目前都沒有這門課的可用資訊。',
      ),
    ).toBeTruthy();
  });

  it('lists boards of the course and its shared course and links to the board', async () => {
    const overrides = services();
    await renderWithServices(<CourseShowView cid="10" />, overrides);

    await fireEvent.press(await screen.findByRole('tab', { name: /討論/ }));

    expect(await screen.findByText('看板 10')).toBeTruthy();
    expect(await screen.findByText('看板 c10')).toBeTruthy();
    expect(screen.getAllByText('甲班')).toHaveLength(2);
    expect(screen.getByText('共用版')).toBeTruthy();
    expect(screen.getByText('新文章')).toBeTruthy();

    await fireEvent.press(screen.getByText('看板 c10'));
    expect(router.push).toHaveBeenCalledWith('/courses/10/discuss/c10/b-c10');
  });

  it('starts on the tab given by the route', async () => {
    await renderWithServices(
      <CourseShowView cid="10" initialTab={resolveCourseTab('homework')} />,
      services(),
    );

    expect(await screen.findByText('作業一')).toBeTruthy();
  });

  it('follows a later tab param change', async () => {
    function Harness() {
      const [tab, setTab] = useState<CourseTab>('materials');

      return (
        <>
          <Pressable onPress={() => setTab('homework')}>
            <Text>go-homework</Text>
          </Pressable>
          <CourseShowView cid="10" initialTab={tab} />
        </>
      );
    }

    await renderWithServices(<Harness />, services());
    expect(screen.queryByText('作業一')).toBeNull();

    await fireEvent.press(screen.getByText('go-homework'));

    expect(await screen.findByText('作業一')).toBeTruthy();
  });

  it('falls back to materials for an unknown tab', () => {
    expect(resolveCourseTab('nope')).toBe('materials');
    expect(resolveCourseTab(undefined)).toBe('materials');
    expect(resolveCourseTab('self-exam')).toBe('self-exam');
  });
});
