import type { LiveSessionItem } from '@altuu/core';

import { toDownloadOptions } from './attachments/downloadRequest';
import {
  courseTasksFor,
  formatBadgeCount,
  formatClock,
  formatSchoolPortalClassDates,
  formatSchoolPortalTimeRange,
  groupCoursesBySemester,
} from './format';
import {
  flattenLiveSessions,
  formatSessionClock,
  groupSessionsByMonth,
  sessionStatus,
  toSessionDate,
} from './liveSessions';
import { buildDirectoryNodes, visibleDirectoryNodes } from './materialTree';
import {
  groupEventsByMonth,
  pickCountdownEvent,
  presentCalendar,
} from './schoolCalendar';

describe('school portal formatting', () => {
  it('formats time ranges with period ordinals', () => {
    expect(formatSchoolPortalTimeRange('1500~1610第5節')).toBe(
      '第五節 – 15:00~16:10',
    );
    expect(formatSchoolPortalTimeRange('1900~2050第12節')).toBe(
      '第十二節 – 19:00~20:50',
    );
    expect(formatSchoolPortalTimeRange('1900~2050')).toBe('19:00~20:50');
    expect(formatSchoolPortalTimeRange('隨堂')).toBe('隨堂');
    expect(formatSchoolPortalTimeRange(null)).toBeNull();
  });

  it('splits class dates into entries', () => {
    expect(
      formatSchoolPortalClassDates('第1次 2026/09/22 第2次 2026/10/20'),
    ).toEqual(['第1次 2026/09/22', '第2次 2026/10/20']);
    expect(formatSchoolPortalClassDates('每週三')).toEqual(['每週三']);
    expect(formatSchoolPortalClassDates(null)).toEqual([]);
  });
});

describe('course helpers', () => {
  it('sums the shared course counts', () => {
    expect(
      courseTasksFor(
        { courseId: 'a', commonCourseId: 'c' },
        {
          a: {
            courseId: 'a',
            pendingHomeworks: 1,
            unreadArticles: 2,
          },
          c: {
            courseId: 'c',
            pendingHomeworks: 3,
            unreadArticles: 4,
          },
        },
      ),
    ).toEqual({ courseId: 'a', pendingHomeworks: 4, unreadArticles: 6 });
  });

  it('groups by trimmed semester with a fallback group', () => {
    const base = {
      commonCourseId: null,
      name: 'n',
      className: null,
      courseType: null,
    };

    expect(
      groupCoursesBySemester([
        { ...base, courseId: '1', semester: ' 114-1 ' },
        { ...base, courseId: '2', semester: '114-1' },
        { ...base, courseId: '3', semester: null },
      ]).map((group) => [group.semester, group.courses.length]),
    ).toEqual([
      ['114-1', 2],
      ['其他', 1],
    ]);
  });

  it('formats badges and clocks', () => {
    expect(formatBadgeCount(100)).toBe('99+');
    expect(formatBadgeCount(7)).toBe('7');
    expect(formatClock(75)).toBe('1:15');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});

describe('live sessions', () => {
  const item = (
    overrides: Partial<LiveSessionItem> = {},
    sessions: Array<{
      date: string;
      startTime: string;
      endTime: string;
    }> = [],
  ): LiveSessionItem => ({
    accountId: 1,
    accountLabel: 'me',
    courseId: 'c',
    courseName: '課',
    semester: null,
    className: '甲',
    classCode: 'X',
    type: null,
    typeLabel: null,
    teacherName: null,
    link: null,
    backupClassroomUrl: null,
    startTime: null,
    endTime: null,
    sessions,
    ...overrides,
  });

  it('reads naive times as Taiwan time', () => {
    expect(toSessionDate('2026-10-20', '19:00:00')?.toISOString()).toBe(
      '2026-10-20T11:00:00.000Z',
    );
    expect(toSessionDate('bad', 'x')).toBeNull();
  });

  it('derives status and sorts ended sessions last', () => {
    const now = new Date('2026-10-20T11:30:00.000Z');
    const sessions = flattenLiveSessions(
      [
        item({}, [
          {
            date: '2026-10-01',
            startTime: '19:00:00',
            endTime: '21:00:00',
          },
          {
            date: '2026-10-20',
            startTime: '19:00:00',
            endTime: '21:00:00',
          },
          {
            date: '2026-10-27',
            startTime: '19:00:00',
            endTime: '21:00:00',
          },
        ]),
      ],
      now,
    );

    expect(sessions.map((session) => [session.date, session.status])).toEqual([
      ['2026-10-20', 'ongoing'],
      ['2026-10-27', 'upcoming'],
      ['2026-10-01', 'ended'],
    ]);
    expect(sessionStatus(null, null, now)).toBe('upcoming');
  });

  it('formats clocks per time zone and groups by month', () => {
    const startAt = toSessionDate('2026-10-31', '03:00:00');
    const taiwan = {
      displayTimezone: 'taiwan' as const,
      timeZone: 'Asia/Taipei',
    };
    const losAngeles = {
      displayTimezone: 'local' as const,
      timeZone: 'America/Los_Angeles',
    };
    const london = {
      displayTimezone: 'local' as const,
      timeZone: 'Europe/London',
    };

    expect(formatSessionClock(startAt, '03:00:00', '2026-10-31', taiwan)).toBe(
      '03:00',
    );
    // The local date differs from the session date, so it is shown.
    expect(
      formatSessionClock(startAt, '03:00:00', '2026-10-31', losAngeles),
    ).toBe('10/30 12:00');
    expect(formatSessionClock(startAt, '03:00:00', '2026-10-31', london)).toBe(
      '10/30 19:00',
    );

    const flat = flattenLiveSessions(
      [
        item({}, [
          {
            date: '2026-10-31',
            startTime: '23:30:00',
            endTime: '23:59:00',
          },
          {
            date: '2026-11-02',
            startTime: '19:00:00',
            endTime: '20:00:00',
          },
        ]),
      ],
      new Date('2026-10-01T00:00:00Z'),
    );

    expect(
      groupSessionsByMonth(flat, 'Asia/Taipei').map((block) => block.monthKey),
    ).toEqual(['2026-10', '2026-11']);
  });
});

describe('school calendar', () => {
  const events = [
    {
      name: '期末考',
      startDate: '2026-12-01',
      endDate: '2026-12-03',
      isCountdown: true,
    },
    {
      name: '開學',
      startDate: '2026-09-01',
      endDate: '2026-09-01',
      isCountdown: false,
    },
    {
      name: '註冊',
      startDate: '2026-10-15',
      endDate: '2026-10-25',
      isCountdown: false,
    },
  ];

  it('classifies events relative to today and picks the countdown', () => {
    const presented = presentCalendar(events, new Date('2026-10-18T09:00:00'));

    expect(presented.map((event) => [event.name, event.status])).toEqual([
      ['開學', 'ended'],
      ['註冊', 'ongoing'],
      ['期末考', 'upcoming'],
    ]);
    expect(presented[2].daysUntil).toBe(44);
    expect(pickCountdownEvent(presented)?.name).toBe('期末考');
    expect(
      groupEventsByMonth(presented).map((month) => month.monthKey),
    ).toEqual(['2026-09', '2026-10', '2026-12']);
  });
});

describe('material tree', () => {
  const nodes = [
    {
      identifier: 'f',
      href: 'h',
      text: '單元',
      level: 0,
      itemDisabled: false,
    },
    {
      identifier: 'a',
      href: 'ha',
      text: '子節',
      level: 1,
      itemDisabled: false,
    },
    {
      identifier: 'b',
      href: null,
      text: '標題',
      level: 0,
      itemDisabled: false,
    },
  ];

  it('splits a node with children and a page into folder + link rows', () => {
    const display = buildDirectoryNodes(nodes);

    expect(display.map((node) => node.internalId)).toEqual([
      'f::folder',
      'f::link',
      'a',
      'b',
    ]);
    expect(display[1]).toMatchObject({
      targetIdentifier: 'f',
      level: 1,
      isSyntheticLink: true,
    });
    expect(display[2].ancestorDirectoryIds).toEqual(['f::folder']);
  });

  it('hides descendants of collapsed folders', () => {
    const display = buildDirectoryNodes(nodes);

    expect(
      visibleDirectoryNodes(display, new Set(['f::folder'])).map(
        (node) => node.internalId,
      ),
    ).toEqual(['f::folder', 'b']);
  });
});

describe('toDownloadOptions', () => {
  it('moves a Cookie header into structured cookies scoped to the url host', () => {
    expect(
      toDownloadOptions(
        {
          url: 'https://uu.nou.edu.tw/f.pdf',
          headers: { 'User-Agent': 'UA', Cookie: 'a=1; b=2=3' },
        },
        'f.pdf',
      ),
    ).toEqual({
      url: 'https://uu.nou.edu.tw/f.pdf',
      headers: { 'User-Agent': 'UA' },
      cookies: [
        { name: 'a', value: '1', domain: 'uu.nou.edu.tw', path: '/' },
        { name: 'b', value: '2=3', domain: 'uu.nou.edu.tw', path: '/' },
      ],
      fileName: 'f.pdf',
    });
  });

  it('prefers explicit cookies and the base url host', () => {
    const options = toDownloadOptions({
      url: 'https://other.test/x',
      headers: { cookie: 'ignored=1' },
      cookies: { s: 'v' },
      baseUrl: 'https://portal.test',
    });

    expect(options.cookies).toEqual([
      { name: 's', value: 'v', domain: 'portal.test', path: '/' },
    ]);
    expect(options.headers).toEqual({});
    expect(options.fileName).toBeUndefined();
  });
});
