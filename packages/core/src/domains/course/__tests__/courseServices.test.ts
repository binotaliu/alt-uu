import { describe, expect, it } from 'vitest';
import {
  loadExpected,
  loadFixture,
  loadFixtureJson,
  loadGolden,
} from '../../../../test/fixtures';
import { SessionInvalidError } from '../../../errors/errors';
import type { FakeResponder } from '../../../http/testing';
import { playbackProgress, accounts } from '../../../db/schema';
import { clearCoursePathInfoCache } from '../coursePath';
import type { CourseItem } from '../types';
import { createCourseHarness, describeRequests } from './harness';

const UU = 'https://uu.nou.edu.tw';
const xmlapi = (action: string): string =>
  `${UU}/xmlapi/index.php?action=${action}&*`;
const page = (
  path: string,
  body: string,
  status = 200,
): [string, FakeResponder] => [
  `${UU}${path}`,
  { status, body, headers: { 'content-type': 'text/html; charset=utf-8' } },
];
const goCourseRoutes: Array<[string, FakeResponder]> = [
  [xmlapi('go-course'), { body: { code: 0 } }],
  page(
    '/learn/path/pathtree.php',
    '<script>var browserTabIdx = "tab-7";</script>',
  ),
];

function goldenJson(name: string): unknown {
  return (loadGolden('course', name).cases[0].output as { json: unknown }).json;
}

describe('listCourses', () => {
  it.each(['list-courses-app-course-type', 'list-courses-hyphenated-class'])(
    '%s',
    async (name) => {
      const { services, ctx } = await createCourseHarness({
        routes: [
          [xmlapi('my-course-list'), { body: loadFixtureJson('course', name) }],
        ],
        session: { profile: undefined },
      });

      expect(await services.listCourses()).toEqual(goldenJson(name));

      const expected = loadExpected('course', name).cases[0].expected as {
        cacheKeyWritten: string;
      };
      expect(await ctx.cache.get(expected.cacheKeyWritten)).toEqual(
        (loadFixtureJson('course', name) as { data: { list: unknown } }).data
          .list,
      );
    },
  );

  it('caches per username, or per account when one is given', async () => {
    const { services, ctx, requests } = await createCourseHarness({
      routes: [
        [
          xmlapi('my-course-list'),
          {
            body: loadFixtureJson('course', 'list-courses-app-course-type'),
          },
        ],
      ],
    });

    await services.listCourses();
    await services.listCourses();
    await services.listCourses({ accountId: 1 });

    expect(describeRequests(requests)).toEqual([
      'xmlapi my-course-list',
      'xmlapi my-course-list',
    ]);
    expect(await ctx.cache.has('alt-uu:courses:list:s123')).toBe(true);
    expect(await ctx.cache.has('alt-uu:courses:list:account:1')).toBe(true);
  });

  it('defaults the semester and name of unparseable titles', async () => {
    const { services } = await createCourseHarness({
      routes: [
        [
          xmlapi('my-course-list'),
          {
            body: {
              code: 0,
              data: {
                list: [{ course_id: 5, title: '' }, 'junk'],
              },
            },
          },
        ],
      ],
    });

    expect(await services.listCourses()).toEqual([
      {
        courseId: '5',
        commonCourseId: null,
        semester: '其他',
        name: '未命名課程',
        className: null,
        courseType: null,
      },
    ]);
  });
});

describe('getCoursePath', () => {
  it.each(['path-info-nested', 'path-info-single-leaf'])('%s', async (name) => {
    const { services } = await createCourseHarness({
      routes: [
        ...goCourseRoutes,
        [
          xmlapi('my-course-path-info'),
          { body: loadFixtureJson('course', name) },
        ],
      ],
    });

    expect(await services.getCoursePath('9001')).toEqual(goldenJson(name));
  });

  it('meets the flattened-node expectations', async () => {
    const { services } = await createCourseHarness({
      routes: [
        ...goCourseRoutes,
        [
          xmlapi('my-course-path-info'),
          { body: loadFixtureJson('course', 'path-info-nested') },
        ],
      ],
    });
    const { materialNodes, pathInfo } = await services.getCoursePath('9001');

    expect(materialNodes).toHaveLength(4);
    expect(pathInfo.code).toBe(0);
    expect(materialNodes[0]).toMatchObject({ identifier: 'A1', level: 0 });
    expect(materialNodes[1].level).toBe(1);
  });

  it('syncs the course once, caches the tree and clears it after study time', async () => {
    const { services, requests, ctx, sessions } = await createCourseHarness({
      routes: [
        ...goCourseRoutes,
        [
          xmlapi('my-course-path-info'),
          { body: loadFixtureJson('course', 'path-info-nested') },
        ],
      ],
    });

    await services.getCoursePath('9001');
    await services.getCoursePath('9001');

    expect(describeRequests(requests)).toEqual([
      'xmlapi go-course',
      `GET ${UU}/learn/path/pathtree.php`,
      'xmlapi my-course-path-info',
    ]);
    expect((await sessions.get())?.cookies).toMatchObject({
      browserTabIdx: 'tab-7',
    });
    expect(await ctx.cache.get('alt-uu:courses:path-info:ids:1')).toEqual([
      '9001',
    ]);

    await clearCoursePathInfoCache(ctx.cache, 1, '9001');

    expect(await ctx.cache.has('alt-uu:courses:path-info:1:9001')).toBe(false);
    expect(await ctx.cache.get('alt-uu:courses:path-info:ids:1')).toEqual([]);

    await services.getCoursePath('9001');
    expect(describeRequests(requests).at(-1)).toBe(
      'xmlapi my-course-path-info',
    );
  });

  it('re-enters the current course after a remembered re-login', async () => {
    const { services, requests } = await createCourseHarness({
      routes: [
        ...goCourseRoutes,
        [
          xmlapi('my-course-path-info'),
          { body: loadFixtureJson('course', 'path-info-nested') },
        ],
      ],
    });

    await services.afterRememberedLogin(1);
    expect(requests).toHaveLength(0);

    await services.getCoursePath('9001');
    await services.afterRememberedLogin(1);

    expect(describeRequests(requests).slice(-2)).toEqual([
      'xmlapi go-course',
      `GET ${UU}/learn/path/pathtree.php`,
    ]);
  });
});

describe('getLearningTimes', () => {
  it('matches the golden', async () => {
    const { services } = await createCourseHarness({
      routes: [
        ...goCourseRoutes,
        [
          xmlapi('my-course-path-info'),
          { body: loadFixtureJson('course', 'path-info-nested') },
        ],
        page(
          '/learn/last10.php?class_id=9001',
          loadFixture('course', 'learning-times-last10'),
        ),
      ],
    });

    expect(await services.getLearningTimes('9001')).toEqual(
      goldenJson('learning-times-last10'),
    );
  });

  it('fails with the legacy 502 message', async () => {
    const { services } = await createCourseHarness({
      routes: [
        ...goCourseRoutes,
        [
          xmlapi('my-course-path-info'),
          { body: loadFixtureJson('course', 'path-info-nested') },
        ],
        page('/learn/last10.php?class_id=9001', 'err', 500),
      ],
    });

    await expect(services.getLearningTimes('9001')).rejects.toMatchObject({
      status: 502,
      message: '讀取學習時數失敗。',
    });
  });
});

describe('getNodeResources', () => {
  it('matches the golden and keeps the list for the session', async () => {
    const { services, requests } = await createCourseHarness({
      routes: [
        [
          xmlapi('course-node-resources'),
          { body: loadFixtureJson('course', 'node-resources-list') },
        ],
      ],
    });

    expect(await services.getNodeResources('9001', 'A2')).toEqual(
      goldenJson('node-resources-list'),
    );
    await services.getNodeResources('9001', 'A2');
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain('cid=9001&scoid=A2');
  });
});

describe('getTasksCount', () => {
  const tasksRoutes = (homework: string, forum: string, status = 200) => [
    page('/learn/my_homework.php', homework, status),
    page('/learn/my_forum.php', forum, status),
  ];

  it.each(['tasks-count-merged', 'tasks-count-malformed'])(
    '%s',
    async (name) => {
      const { services } = await createCourseHarness({
        routes: tasksRoutes(
          loadFixture('course', `${name}.homework.html`),
          loadFixture('course', `${name}.forum.html`),
        ),
      });

      expect(await services.getTasksCount()).toEqual(goldenJson(name));
    },
  );

  it('retries once on empty pages, then returns nothing', async () => {
    const empty = loadFixture('course', 'tasks-count-empty-and-errors');
    const { services, requests } = await createCourseHarness({
      routes: tasksRoutes(empty, empty),
    });

    expect(await services.getTasksCount()).toEqual(
      goldenJson('tasks-count-empty-and-errors'),
    );
    expect(requests).toHaveLength(4);
  });

  it('handles server errors gracefully', async () => {
    const { services } = await createCourseHarness({
      routes: tasksRoutes('Server Error', 'Server Error', 502),
    });

    expect(await services.getTasksCount()).toEqual([]);
  });

  it('requires a HUNGU session', async () => {
    const { services } = await createCourseHarness({ session: null });

    await expect(services.getTasksCount()).rejects.toBeInstanceOf(
      SessionInvalidError,
    );
  });
});

describe('getHomeworks', () => {
  it('maps homeworks with action and result urls', async () => {
    const { services, requests } = await createCourseHarness({
      routes: [
        ...goCourseRoutes,
        page(
          '/learn/homework/homework_list.php',
          loadFixture('course', 'homeworks-uu-list'),
        ),
        [xmlapi('my-course-list'), { body: { code: 0, data: { list: [] } } }],
      ],
    });

    expect(await services.getHomeworks('1001')).toEqual(
      goldenJson('homeworks-uu-list'),
    );
    expect(describeRequests(requests).slice(0, 3)).toEqual([
      'xmlapi go-course',
      `GET ${UU}/learn/path/pathtree.php`,
      `GET ${UU}/learn/homework/homework_list.php`,
    ]);
    expect(requests[0].url).toContain('cid=1001');
  });

  it('adds the school portal notices of the matching course', async () => {
    const expected = loadExpected('course', 'homeworks-school-portal-notices')
      .cases[0];
    const notices = (
      goldenJson('homeworks-school-portal-notices') as {
        schoolPortalNotices: unknown[];
      }
    ).schoolPortalNotices;
    const coursesSeen: CourseItem[] = [];
    const { services } = await createCourseHarness({
      routes: [
        ...goCourseRoutes,
        page('/learn/homework/homework_list.php', '<html><body></body></html>'),
        [
          xmlapi('my-course-list'),
          {
            body: (expected.input as { courseListPayload: object })
              .courseListPayload,
          },
        ],
      ],
      services: {
        getSchoolPortalHomeworkNotices: async (course) => {
          coursesSeen.push(course);

          return notices as never;
        },
      },
    });

    expect(await services.getHomeworks('9001')).toEqual(
      goldenJson('homeworks-school-portal-notices'),
    );
    expect(coursesSeen).toEqual([
      expect.objectContaining({
        courseId: '9001',
        semester: '115暑',
        name: '假課程乙',
      }),
    ]);
  });

  it('ignores school portal failures', async () => {
    const { services } = await createCourseHarness({
      routes: [
        ...goCourseRoutes,
        page('/learn/homework/homework_list.php', '<html><body></body></html>'),
        [
          xmlapi('my-course-list'),
          {
            body: {
              code: 0,
              data: {
                list: [{ course_id: '9001', title: '(115暑)乙' }],
              },
            },
          },
        ],
      ],
      services: {
        getSchoolPortalHomeworkNotices: async () => {
          throw new Error('portal down');
        },
      },
    });

    expect(await services.getHomeworks('9001')).toEqual({
      homeworkItems: [],
      schoolPortalNotices: [],
    });
  });

  it('fails with the legacy 502 message', async () => {
    const { services } = await createCourseHarness({
      routes: [
        ...goCourseRoutes,
        page('/learn/homework/homework_list.php', '', 500),
      ],
    });

    await expect(services.getHomeworks('1')).rejects.toMatchObject({
      status: 502,
      message: '讀取作業列表失敗。',
    });
  });
});

describe('getSelfExams', () => {
  it('matches the golden', async () => {
    const { services, requests } = await createCourseHarness({
      routes: [
        ...goCourseRoutes,
        page(
          '/learn/exam/co_self_exam_list.php',
          loadFixture('course', 'self-exams-list'),
        ),
      ],
    });

    expect(await services.getSelfExams('4242')).toEqual(
      goldenJson('self-exams-list'),
    );
    expect(describeRequests(requests)).toEqual([
      'xmlapi go-course',
      `GET ${UU}/learn/path/pathtree.php`,
      `GET ${UU}/learn/exam/co_self_exam_list.php`,
    ]);
  });
});

describe('material access without the local proxy', () => {
  it('getNodeContent parses the node href and returns empty content otherwise', async () => {
    const { services } = await createCourseHarness({
      routes: [
        [
          xmlapi('my-course-path-info'),
          { body: loadFixtureJson('course', 'path-info-nested') },
        ],
        [
          `${UU}/material/lesson-1.html?ticket=abc123&x=1`,
          {
            body: '<html><body><h2>第一章內容</h2><img src="/images/cover.jpg" alt="cover"></body></html>',
            headers: { 'content-type': 'text/html' },
          },
        ],
      ],
    });

    expect((await services.getNodeContent('9001', 'A2')).htmlContent).toBe(
      `<p>第一章內容<img src="${UU}/images/cover.jpg" alt="cover"></p>`,
    );
    expect(
      (await services.getNodeContent('9001', 'A1')).htmlContent,
    ).toBeNull();
    expect(
      (await services.getNodeContent('9001', 'missing')).htmlContent,
    ).toBeNull();
  });

  it('prepareMaterialFetch returns the native fetch request for same-host URLs', async () => {
    const { services, requests } = await createCourseHarness({
      routes: goCourseRoutes,
      session: { cookies: { WM: 'cookie', PHPSESSID: 'abc' } },
    });

    expect(
      await services.prepareMaterialFetch(`${UU}/media/lesson-1.mp3`, {
        cid: '1001',
      }),
    ).toEqual({
      url: `${UU}/media/lesson-1.mp3`,
      headers: {
        'User-Agent': 'test-agent',
        Origin: UU,
        Referer: `${UU}/learn/index.php`,
        Cookie: 'WM=cookie; PHPSESSID=abc; browserTabIdx=tab-7',
        Accept: '*/*',
      },
    });
    expect(describeRequests(requests)[0]).toBe('xmlapi go-course');
    await expect(
      services.prepareMaterialFetch('https://evil.example.com/x.png'),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('merges Set-Cookie from material fetches into the session', async () => {
    const { services, sessions } = await createCourseHarness({
      routes: [
        [
          `${UU}/material/page.html`,
          {
            body: '<p>x</p>',
            headers: { 'content-type': 'text/html' },
            setCookies: ['fresh=1; path=/'],
          },
        ],
      ],
    });

    await services.getParsedMaterialContent(`${UU}/material/page.html`);

    expect((await sessions.get())?.cookies).toEqual({
      WM: 'cookie',
      fresh: '1',
    });
  });
});

describe('playback progress reads', () => {
  it('returns the latest progress and one activity', async () => {
    const { services, ctx } = await createCourseHarness();
    await ctx.db.insert(accounts).values({ id: 1, username: 's123' });
    await ctx.db.insert(playbackProgress).values([
      {
        accountId: 1,
        cid: '1001',
        activityId: 'N-1',
        durationSeconds: 30,
        positionSeconds: 12.5,
        mediaDurationSeconds: 100,
        hunguUploadSuccess: true,
        updatedAt: new Date('2026-01-02T03:04:05Z'),
      },
      {
        accountId: 1,
        cid: '1001',
        activityId: 'N-2',
        positionSeconds: 3,
        updatedAt: new Date('2026-01-03T00:00:00Z'),
      },
    ]);

    expect(await services.getLastSeenMaterial('1001')).toEqual({
      activityId: 'N-2',
      positionSeconds: 3,
      mediaDurationSeconds: null,
    });
    expect(await services.getLastSeenMaterial('9999')).toEqual({
      activityId: null,
      positionSeconds: null,
      mediaDurationSeconds: null,
    });
    expect(await services.getPlaybackProgress('1001', 'N-1')).toEqual({
      progress: {
        cid: '1001',
        activityId: 'N-1',
        studySeconds: 30,
        positionSeconds: 12.5,
        mediaDurationSeconds: 100,
        hunguUploadSuccess: true,
        updatedAt: '2026-01-02T03:04:05+00:00',
      },
    });
    expect(await services.getPlaybackProgress('1001', 'nope')).toEqual({
      progress: null,
    });
  });
});
