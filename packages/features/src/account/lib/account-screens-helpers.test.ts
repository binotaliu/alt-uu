import { formatSchoolPortalTimeRange } from '../../courses/format';
import { groupExamAgenda } from '../screens/ExamInfoScreen';
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

        expect(groups.map((group) => group.label)).toEqual([
            '期中考',
            '期末考',
        ]);
        expect(groups[1]?.dateGroups.map((group) => group.date)).toEqual([
            '2026年12月13日(星期日)',
            '2026年12月20日(星期日)',
        ]);
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
            summarize([row('hungu', true), row('nou_tools', false)], true)
                .level,
        ).toBe('warning');
        expect(
            summarize([row('hungu', true), row('iap', true)], true).level,
        ).toBe('ok');
    });
});

describe('store disclosure', () => {
    it('names the store of the platform', () => {
        expect(storeDisclosure('ios')).toContain('Apple App Store');
        expect(storeDisclosure('android')).toContain('Google Play');
    });
});
