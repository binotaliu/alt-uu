import { describe, expect, it } from 'vitest';
import { createTestContext } from '../../../test/db/helpers';
import { loadFixture, loadGolden } from '../../../test/fixtures';
import {
    normalizeCourseName,
    normalizeTermCode,
} from '../course/support/courseNameMatcher';
import {
    createSchoolPortalDomainServices,
    type SchoolPortalCourseRef,
} from './index';

type Pages = Partial<
    Record<
        'homework' | 'grades' | 'historical' | 'classSession' | 'exam',
        { status?: number; body: string } | Error
    >
>;

const D = 'school-portal';

async function setup(
    pages: Pages,
    options: {
        courses?: SchoolPortalCourseRef[];
        username?: string | null;
    } = {},
) {
    const context = await createTestContext();
    const calls: string[] = [];
    const page =
        (key: keyof Pages) =>
        async (): Promise<{ status: number; body: string }> => {
            calls.push(key);
            const reply = pages[key] ?? { status: 200, body: '' };

            if (reply instanceof Error) {
                throw reply;
            }

            return { status: reply.status ?? 200, body: reply.body };
        };
    const services = createSchoolPortalDomainServices({
        client: {
            fetchHomeworkNoticesPage: page('homework'),
            fetchCurrentSemesterGradesPage: page('grades'),
            fetchHistoricalGradesPage: page('historical'),
            fetchClassSessionInfoPage: page('classSession'),
            fetchExamInfoPage: page('exam'),
        },
        cache: context.cache,
        getProfileUsername: () =>
            options.username === undefined ? 'u1001' : options.username,
        portalBaseUrl: 'https://nouapp.nou.edu.tw',
        listCourses: async () => options.courses ?? [],
    });

    return { ...context, services, calls };
}

const course = (
    courseId: string,
    semester: string,
    name: string,
): SchoolPortalCourseRef => ({ courseId, semester, name });

function goldenCases(name: string) {
    return loadGolden(D, name).cases as Array<{
        name: string;
        input: { course: SchoolPortalCourseRef };
        output: unknown;
    }>;
}

describe('CourseNameMatcher', () => {
    it('normalizes names like the legacy matcher', () => {
        expect(normalizeCourseName(' 假課程：附標點符號（其一～其二） ')).toBe(
            '假課程附標點符號其一其二',
        );
        expect(normalizeCourseName('ＡＢＣ 101')).toBe('abc101');
        expect(normalizeCourseName('  ')).toBe('');
    });

    it('normalizes term codes from every label form', () => {
        expect(normalizeTermCode('114下')).toBe('2025B');
        expect(normalizeTermCode('114學年下學期')).toBe('2025B');
        expect(normalizeTermCode('114上學期')).toBe('2025A');
        expect(normalizeTermCode('115暑')).toBe('2026C');
        expect(normalizeTermCode('115學年暑期')).toBe('2026C');
        expect(normalizeTermCode('115暑期')).toBe('2026C');
        expect(normalizeTermCode('foo')).toBeNull();
        expect(normalizeTermCode(null)).toBeNull();
    });
});

describe('parity: current semester grade (qryscore)', () => {
    for (const goldenCase of goldenCases('semester-grade-qryscore')) {
        it(goldenCase.name, async () => {
            const { services } = await setup({
                grades: { body: loadFixture(D, 'semester-grade-qryscore') },
            });

            expect(
                await services.getCourseSemesterGrade(goldenCase.input.course),
            ).toEqual(goldenCase.output);
        });
    }
});

describe('parity: historical grade fallback (qryscore2)', () => {
    for (const goldenCase of goldenCases('semester-grade-qryscore2')) {
        it(goldenCase.name, async () => {
            const { services } = await setup({
                grades: { body: loadFixture(D, 'semester-grade-qryscore') },
                historical: {
                    body: loadFixture(D, 'semester-grade-qryscore2'),
                },
            });

            expect(
                await services.getCourseSemesterGrade(goldenCase.input.course),
            ).toEqual(goldenCase.output);
        });
    }
});

describe('parity: class session info (qryper)', () => {
    for (const goldenCase of goldenCases('class-session-qryper')) {
        it(goldenCase.name, async () => {
            const { services } = await setup({
                classSession: { body: loadFixture(D, 'class-session-qryper') },
            });

            expect(
                await services.getCourseClassSessionInfo(
                    goldenCase.input.course,
                ),
            ).toEqual(goldenCase.output);
        });
    }
});

describe('parity: exam info (qryexm)', () => {
    for (const goldenCase of goldenCases('exam-info-qryexm')) {
        it(goldenCase.name, async () => {
            const { services } = await setup({
                exam: { body: loadFixture(D, 'exam-info-qryexm') },
            });

            expect(
                await services.getCourseExamInfo(goldenCase.input.course),
            ).toEqual(goldenCase.output);
        });
    }
});

describe('parity: homework notices (qryass)', () => {
    for (const fixture of [
        'homework-notices-qryass',
        'homework-notices-qryass-multi-course',
    ]) {
        for (const goldenCase of goldenCases(fixture)) {
            it(`${fixture}: ${goldenCase.name}`, async () => {
                const { services } = await setup({
                    homework: { body: loadFixture(D, fixture) },
                });

                expect(
                    await services.getSchoolPortalHomeworkNotices(
                        goldenCase.input.course,
                    ),
                ).toEqual(goldenCase.output);
            });
        }
    }

    it('absolutizes relative download links and keeps absolute ones', async () => {
        const html = `<div class="year-box"><div class="year">115學年上學期</div></div>
            <div class="accordion-item"><button class="accordion-button">第1次作業</button>
            <div class="accordion-body">
              <div class="detail-title">假課程甲</div>
              <div class="detail-url"><a href="/device/x?a=1">dl</a></div>
              <div class="detail-title">假課程乙</div>
              <div class="detail-url"><a href="https://other.example/f.pdf">dl</a></div>
              <div class="detail-title">假課程丙</div>
              <div class="detail-url"><span>none</span></div>
            </div></div>`;
        const { services } = await setup({ homework: { body: html } });
        const urlOf = async (name: string) =>
            (
                await services.getSchoolPortalHomeworkNotices(
                    course('1', '115上', name),
                )
            )[0]?.downloadUrl;

        expect(await urlOf('假課程甲')).toBe(
            'https://nouapp.nou.edu.tw/device/x?a=1',
        );
        expect(await urlOf('假課程乙')).toBe('https://other.example/f.pdf');
        expect(await urlOf('假課程丙')).toBeNull();
    });
});

describe('parity: GET /api/grades', () => {
    it('returns every grade, most recent semester first, deduping', async () => {
        const { services } = await setup({
            grades: { body: loadFixture(D, 'all-grades.qryscore') },
            historical: { body: loadFixture(D, 'all-grades.qryscore2') },
        });
        const golden = loadGolden(D, 'all-grades').cases[0] as {
            output: { json: { grades: unknown } };
        };

        expect(await services.getAllCourseGrades()).toEqual(
            golden.output.json.grades,
        );
    });

    it('returns an empty list when the portal has no grades', async () => {
        const { services } = await setup({
            grades: { status: 500, body: '' },
            historical: { status: 500, body: '' },
        });

        expect(await services.getAllCourseGrades()).toEqual([]);
    });
});

describe('parity: GET /api/exam-agenda', () => {
    it('returns only 正考 exams with a time, ordered ascending', async () => {
        const { services } = await setup({
            exam: { body: loadFixture(D, 'exam-agenda') },
        });
        const golden = loadGolden(D, 'exam-agenda').cases[0] as {
            output: { json: { items: unknown } };
        };

        expect(await services.getExamAgenda()).toEqual(
            golden.output.json.items,
        );
    });

    it('returns an empty list when the portal has no exam info', async () => {
        const { services } = await setup({ exam: { status: 500, body: '' } });

        expect(await services.getExamAgenda()).toEqual([]);
    });
});

describe('parity: GET /api/courses/{cid}/grades', () => {
    const courses = [course('9001', '114下', '假課程甲')];
    const pages = { grades: { body: loadFixture(D, 'course-grade') } };

    it('returns the matching grade', async () => {
        const { services } = await setup(pages, { courses });
        const golden = loadGolden(D, 'course-grade').cases[0] as {
            output: { json: { grade: unknown } };
        };

        expect(await services.getCourseGrade('9001')).toEqual(
            golden.output.json.grade,
        );
    });

    it('returns null when the course is not found', async () => {
        const { services, calls } = await setup(pages, { courses: [] });

        expect(await services.getCourseGrade('does-not-exist')).toBeNull();
        expect(calls).toEqual([]);
    });

    it('degrades to null when the portal request fails', async () => {
        const { services } = await setup(
            { grades: new Error('portal down') },
            { courses },
        );

        expect(await services.getCourseGrade('9001')).toBeNull();
    });
});

describe('parity: GET /api/courses/{cid}/school-portal-info', () => {
    const courses = [course('9001', '115上', '假課程甲')];
    const pages: Pages = {
        classSession: { body: loadFixture(D, 'school-portal-info.qryper') },
        exam: { body: loadFixture(D, 'school-portal-info.qryexm') },
    };

    it('returns class session and exam info', async () => {
        const { services } = await setup(pages, { courses });
        const golden = loadGolden(D, 'school-portal-info').cases[0] as {
            output: { json: unknown };
        };

        expect(await services.getCourseSchoolPortalInfo('9001')).toEqual(
            golden.output.json,
        );
    });

    it('returns nulls when the course is not found', async () => {
        const { services } = await setup(pages, { courses: [] });

        expect(await services.getCourseSchoolPortalInfo('nope')).toEqual({
            classSessionInfo: null,
            examInfo: null,
        });
    });

    it('degrades each half independently when one page throws', async () => {
        const { services } = await setup(
            { ...pages, classSession: new Error('boom') },
            { courses },
        );
        const result = await services.getCourseSchoolPortalInfo('9001');

        expect(result.classSessionInfo).toBeNull();
        expect(result.examInfo?.schedules[0]?.category).toBe('期中考(正考)');
    });
});

describe('caching', () => {
    const courses = [course('9001', '114下', '假課程甲')];

    it('caches pages under the legacy keys and per-user scope', async () => {
        const { services, calls, cache } = await setup(
            {
                grades: { body: loadFixture(D, 'semester-grade-qryscore') },
                historical: { body: '' },
                homework: { body: loadFixture(D, 'homework-notices-qryass') },
                classSession: { body: loadFixture(D, 'class-session-qryper') },
                exam: { body: loadFixture(D, 'exam-info-qryexm') },
            },
            { courses },
        );

        await services.getCourseSemesterGrade(courses[0]!);
        await services.getCourseSemesterGrade(courses[0]!);
        await services.getExamAgenda();
        await services.getExamAgenda();
        await services.getCourseClassSessionInfo(courses[0]!);
        await services.getSchoolPortalHomeworkNotices(courses[0]!);
        await services.getSchoolPortalHomeworkNotices(courses[0]!);

        expect(calls.filter((call) => call === 'grades')).toHaveLength(1);
        expect(calls.filter((call) => call === 'exam')).toHaveLength(1);
        expect(calls.filter((call) => call === 'homework')).toHaveLength(1);

        for (const key of [
            'alt-uu:school-portal:semester-grades:u1001',
            'alt-uu:school-portal:exam-info:u1001',
            'alt-uu:school-portal:class-session-info:u1001',
            'alt-uu:school-portal:homework-notices:u1001',
        ]) {
            expect(await cache.has(key)).toBe(true);
        }
    });

    it('uses historical key and 60 minute TTL, and the anonymous scope', async () => {
        const { services, cache, clock } = await setup(
            { grades: { body: '' }, historical: { body: '' } },
            { username: null },
        );

        await services.getAllCourseGrades();

        expect(
            await cache.has('alt-uu:school-portal:historical-grades:anonymous'),
        ).toBe(true);
        expect(
            await cache.has('alt-uu:school-portal:semester-grades:anonymous'),
        ).toBe(true);

        clock.advanceSeconds(11 * 60);
        expect(
            await cache.has('alt-uu:school-portal:semester-grades:anonymous'),
        ).toBe(false);
        expect(
            await cache.has('alt-uu:school-portal:historical-grades:anonymous'),
        ).toBe(true);

        clock.advanceSeconds(50 * 60);
        expect(
            await cache.has('alt-uu:school-portal:historical-grades:anonymous'),
        ).toBe(false);
    });
});
