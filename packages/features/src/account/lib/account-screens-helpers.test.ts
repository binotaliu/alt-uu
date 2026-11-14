import { formatSchoolPortalTimeRange } from '../../courses/format';
import {
  examEndsAt,
  findExamScopes,
  groupExamAgenda,
  splitExamsByStatus,
} from '../screens/ExamInfoScreen';
import { groupBySemester, isScorePassing } from '../screens/GradesScreen';
import { summarize } from '../screens/ConnectivityDiagnosticsScreen';
import { storeDisclosure } from '../screens/SubscriptionScreen';

describe('school portal formatting', () => {
  it('reformats period and plain time ranges', () => {
    expect(formatSchoolPortalTimeRange('1500~1610第5節')).toBe(
      '第五節 – 15:00~16:10',
    );
    expect(formatSchoolPortalTimeRange('1900~2050')).toBe('19:00~20:50');
    expect(formatSchoolPortalTimeRange('1000~1100第12節')).toBe(
      '第十二節 – 10:00~11:00',
    );
    expect(formatSchoolPortalTimeRange('待公告')).toBe('待公告');
    expect(formatSchoolPortalTimeRange(null)).toBeNull();
  });
});

describe('grade helpers', () => {
  it('groups consecutive grades by semester', () => {
    const grade = (semesterLabel: string, courseName: string) =>
      ({ semesterLabel, courseName }) as never;

    expect(
      groupBySemester([
        grade('114-1', 'A'),
        grade('114-1', 'B'),
        grade('113-2', 'C'),
      ]).map((group) => [group.semesterLabel, group.grades.length]),
    ).toEqual([
      ['114-1', 2],
      ['113-2', 1],
    ]);
  });

  it('sorts semesters newest first with 暑期 before 上學期 before 下學期', () => {
    const grade = (semesterLabel: string) =>
      ({ semesterLabel, courseName: 'X' }) as never;

    expect(
      groupBySemester([
        grade('114 學年上學期'),
        grade('114 學年下學期'),
        grade('115 暑期'),
        grade('115 學年上學期'),
      ]).map((group) => group.semesterLabel),
    ).toEqual([
      '115 學年上學期',
      '115 暑期',
      '114 學年下學期',
      '114 學年上學期',
    ]);
  });

  it('treats 60 and above as passing', () => {
    expect([null, '59', '60', '99', '免修'].map(isScorePassing)).toEqual([
      false,
      false,
      true,
      true,
      false,
    ]);
  });
});

describe('exam agenda grouping', () => {
  it('groups by exam kind (without the 正考 qualifier), then by date', () => {
    const item = (
      category: string,
      date: string | null,
      courseName: string,
    ) => ({
      courseName,
      category,
      date,
      time: '0900~1000',
      room: null,
    });

    const groups = groupExamAgenda([
      item('期末考(正考)', '2026年12月20日(星期日)', 'B'),
      item('期中考(正考)', '2026年11月08日(星期日)', 'A'),
      item('期末考（正考）', '2026年12月13日(星期日)', 'C'),
    ]);

    expect(groups.map((group) => group.label)).toEqual(['期中考', '期末考']);
    expect(groups[1]?.dateGroups.map((group) => group.date)).toEqual([
      '2026年12月13日(星期日)',
      '2026年12月20日(星期日)',
    ]);
  });
});

describe('exam status sections', () => {
  const exam = (courseName: string, date: string | null, time: string | null) =>
    ({ courseName, category: '期中考(正考)', date, time, room: null }) as never;

  it('parses the exam end as Taiwan time', () => {
    expect(
      examEndsAt(
        exam('A', '2026年11月07日(星期六)', '1500~1610第5節'),
      )?.toISOString(),
    ).toBe('2026-11-07T08:10:00.000Z');
    expect(examEndsAt(exam('A', null, '1500~1610'))).toBeNull();
    expect(
      examEndsAt(exam('A', '2026年11月07日(星期六)', '待公告')),
    ).toBeNull();
  });

  it('puts finished exams in 已結束 and keeps ongoing / unparsable ones up top', () => {
    const now = new Date('2026-11-07T07:30:00Z'); // 15:30 in Taiwan
    const [upcoming, ended] = splitExamsByStatus(
      [
        exam('past', '2026年11月06日(星期五)', '1500~1610'),
        exam('ongoing', '2026年11月07日(星期六)', '1500~1610'),
        exam('future', '2026年11月08日(星期日)', '0900~1010'),
        exam('unknown', '2026年11月08日(星期日)', '待公告'),
      ],
      now,
    );

    expect(upcoming.items.map((item) => item.courseName)).toEqual([
      'ongoing',
      'future',
      'unknown',
    ]);
    expect(ended.items.map((item) => item.courseName)).toEqual(['past']);
    expect(ended.label).toBe('已結束');
  });
});

describe('all-accounts grouping', () => {
  it('groups grades of different accounts under one semester', () => {
    const row = (
      semesterLabel: string,
      courseName: string,
      accountId: number,
    ) => ({ semesterLabel, courseName, accountId }) as never;
    const groups = groupBySemester([
      row('114 學年上學期', 'A1', 1),
      row('113 學年下學期', 'A2', 1),
      row('114 學年上學期', 'B1', 2),
    ]);

    expect(
      groups.map((group) => [
        group.semesterLabel,
        group.grades.map((grade) => grade.courseName),
      ]),
    ).toEqual([
      ['114 學年上學期', ['A1', 'B1']],
      ['113 學年下學期', ['A2']],
    ]);
  });

  it('groups exams of different accounts by term, then date, then time', () => {
    const item = (courseName: string, category: string, time: string) =>
      ({
        courseName,
        category,
        date: '2026年11月07日(星期六)',
        time,
        room: null,
      }) as never;
    const groups = groupExamAgenda([
      item('A late', '期中考(正考)', '1900~2050'),
      item('A final', '期末考(正考)', '1500~1610'),
      item('B early', '期中考(正考)', '1500~1610'),
    ]);

    expect(groups.map((group) => group.label)).toEqual(['期中考', '期末考']);
    expect(
      groups[0].dateGroups[0].items.map((entry) => entry.courseName),
    ).toEqual(['B early', 'A late']);
  });
});

describe('findExamScopes by account', () => {
  it('keeps same-named courses of different accounts apart', () => {
    const scopes = [
      {
        accountId: 1,
        courseName: 'A',
        scopes: [{ category: '期中考試範圍', scope: '甲帳號範圍' }],
      },
      {
        accountId: 2,
        courseName: 'A',
        scopes: [{ category: '期中考試範圍', scope: '乙帳號範圍' }],
      },
    ];

    expect(findExamScopes(scopes, 'A', '期中考', 2)).toEqual(['乙帳號範圍']);
    expect(findExamScopes(scopes, 'A', '期中考', 3)).toEqual([]);
  });
});

describe('findExamScopes', () => {
  const scopes = [
    {
      courseName: 'A',
      scopes: [
        { category: '期中考試範圍', scope: '第一章～第六章' },
        { category: '期末考試範圍', scope: null },
      ],
    },
  ];

  it('matches the scope category by exam group prefix', () => {
    expect(findExamScopes(scopes, 'A', '期中考')).toEqual(['第一章～第六章']);
  });

  it('skips empty scopes and unknown courses', () => {
    expect(findExamScopes(scopes, 'A', '期末考')).toEqual([]);
    expect(findExamScopes(scopes, 'B', '期中考')).toEqual([]);
  });
});

describe('connectivity overview', () => {
  const row = (service: string, reachable: boolean) =>
    ({ service, status: 'done', reachable }) as never;

  it('reports an offline device first', () => {
    expect(summarize([], false).level).toBe('error');
  });

  it('is loading until every row finished', () => {
    expect(
      summarize([{ service: 'hungu', status: 'checking' } as never], true)
        .level,
    ).toBe('loading');
  });

  it('is an error when HUNGU is unreachable and a warning for other services', () => {
    expect(summarize([row('hungu', false)], true).level).toBe('error');
    expect(
      summarize([row('hungu', true), row('nou_tools', false)], true).level,
    ).toBe('warning');
    expect(summarize([row('hungu', true), row('iap', true)], true).level).toBe(
      'ok',
    );
  });
});

describe('store disclosure', () => {
  it('names the store of the platform', () => {
    expect(storeDisclosure('ios')).toContain('Apple App Store');
    expect(storeDisclosure('android')).toContain('Google Play');
  });
});
