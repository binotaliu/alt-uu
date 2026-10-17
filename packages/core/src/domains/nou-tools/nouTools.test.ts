import { describe, expect, it } from 'vitest';
import {
    loadExpected,
    loadFixtureJson,
    loadGolden,
} from '../../../test/fixtures';
import {
    createHarness,
    type FakeRoutes,
    type Harness,
} from '../account/testing';
import { createAppPreferenceServices } from '../app-preference';
import {
    createNouToolsServices,
    normalizeCourseName,
    normalizeTermCode,
    type NouToolsUserCourse,
} from './index';

const NOU_TOOLS = 'https://nou-tools.binota.org/api/v1';

interface HunguCourseList {
    data: { list: Array<{ course_id: string; title: string }> };
}

/** Test-local copy of the course domain's title parsing (ListCourses TITLE_PATTERN). */
function parseCourses(payload: HunguCourseList): NouToolsUserCourse[] {
    return payload.data.list.map((course) => {
        const match =
            /^\((?<semester>[^)]+)\)(?<name>.+?)(?:-(?<className>.+))?$/u.exec(
                course.title,
            );

        return {
            courseId: course.course_id,
            name: match?.groups?.name.trim() ?? course.title,
            semester: match?.groups?.semester.trim() ?? '其他',
            className: match?.groups?.className?.trim() || null,
        };
    });
}

function nouToolsRoutes(
    prefix: string,
    extra: { calendar?: boolean } = {},
): FakeRoutes {
    const detail = loadFixtureJson<{ id: number }>(
        'nou-tools',
        `${prefix}.course-detail`,
    );
    const termCourses = loadFixtureJson<Array<{ term: string }>>(
        'nou-tools',
        `${prefix}.term-courses`,
    );
    const routes: FakeRoutes = [
        [`${NOU_TOOLS}/courses/${detail.id}`, { body: detail }],
        [
            `${NOU_TOOLS}/courses?term=${termCourses[0].term}`,
            { body: termCourses },
        ],
    ];

    if (extra.calendar === true) {
        routes.push([
            `${NOU_TOOLS}/school-calendar`,
            { body: loadFixtureJson('nou-tools', `${prefix}.school-calendar`) },
        ]);
    }

    return routes;
}

async function setup(routes: FakeRoutes, options: { enabled?: boolean } = {}) {
    const harness = await createHarness(routes);
    const preferences = createAppPreferenceServices({
        keyValues: harness.keyValues,
        isSubscriptionActive: async () => true,
    });
    await preferences.update({
        nouToolsIntegrationEnabled: options.enabled ?? true,
    });
    const nouTools = createNouToolsServices({
        fetch: harness.fake.fetch,
        cache: harness.cache,
        credentials: harness.credentials,
        activeAccountId: () => harness.activeProfile.get(),
        hunguSessions: harness.hunguSessions,
        isIntegrationEnabled: () =>
            preferences.store.getNouToolsIntegrationEnabled(),
        listUserCourses: async (accountId) => {
            const { payload } = await harness.course.fetchCourseList(
                accountId ?? undefined,
            );

            return parseCourses(payload as unknown as HunguCourseList);
        },
        sleep: async () => {},
    });

    return { harness, nouTools };
}

async function seedSession(
    harness: Harness,
    options: {
        username: string;
        baseUrl: string;
        displayName: string;
        nickname?: string;
    },
) {
    const id = await harness.credentials.upsert({
        username: options.username,
        password: 'secret',
    });
    await harness.hunguSessions.put(
        {
            baseUrl: options.baseUrl,
            userAgent: 'test-agent',
            cookies: { WM: 'cookie' },
            ticket: 'ticket',
            profile: {
                display_name: options.displayName,
                username: options.username,
                picture: '',
                realname: options.displayName,
            },
        },
        id,
    );

    if (options.nickname !== undefined) {
        await harness.credentials.setNickname(id, options.nickname);
    }

    return id;
}

function courseListRoute(baseUrl: string, fixture: string): FakeRoutes[number] {
    return [
        `${baseUrl}/xmlapi/index.php?action=my-course-list*`,
        { body: loadFixtureJson('nou-tools', fixture) },
    ];
}

// Parity with the real PHP output of the NouTools endpoints.
describe('nou-tools live sessions (golden)', () => {
    for (const scenario of [
        'live-sessions-unified-zzz000',
        'live-sessions-undivided-display-name',
        'live-sessions-undivided-no-suffix',
    ]) {
        it(scenario, async () => {
            const golden = loadGolden('nou-tools', scenario).cases[0];
            const { harness, nouTools } = await setup([
                courseListRoute(
                    'https://uu.nou.edu.tw',
                    `${scenario}.my-course-list`,
                ),
                ...nouToolsRoutes(scenario),
            ]);
            await seedSession(harness, {
                username: 's123',
                baseUrl: 'https://uu.nou.edu.tw',
                displayName: '測試',
            });

            expect(await nouTools.liveSessions()).toEqual(
                (golden.output as { json: unknown }).json,
            );
        });
    }

    it('live sessions, school calendar and course info (live-sessions-calendar-info)', async () => {
        const golden = loadGolden('nou-tools', 'live-sessions-calendar-info');
        const { harness, nouTools } = await setup([
            courseListRoute(
                'https://uu.nou.edu.tw',
                'live-sessions-calendar-info.my-course-list',
            ),
            ...nouToolsRoutes('live-sessions-calendar-info', {
                calendar: true,
            }),
        ]);
        await seedSession(harness, {
            username: 's123',
            baseUrl: 'https://uu.nou.edu.tw',
            displayName: '測試',
        });
        const output = (name: string) =>
            golden.cases.find((candidate) => candidate.name === name)
                ?.output as { json: unknown };

        expect(await nouTools.liveSessions()).toEqual(
            output('live-sessions').json,
        );
        expect(await nouTools.schoolCalendar()).toEqual(
            output('school-calendar').json,
        );
        expect(await nouTools.courseInfo('1001')).toEqual(
            output('nou-tools-info').json,
        );

        const expected = loadExpected(
            'nou-tools',
            'live-sessions-calendar-info',
        ).cases[0].expected as {
            requests: { someUrlContains: string };
        };
        expect(
            harness.requests.some((request) =>
                request.url.includes(expected.requests.someUrlContains),
            ),
        ).toBe(true);
    });

    it('returns nothing while the integration preference is off', async () => {
        const { harness, nouTools } = await setup([], { enabled: false });
        await seedSession(harness, {
            username: 's123',
            baseUrl: 'https://uu.nou.edu.tw',
            displayName: '測試',
        });

        expect(await nouTools.liveSessions()).toEqual([]);
        expect(await nouTools.schoolCalendar()).toEqual([]);
        expect(await nouTools.courseInfo('1001')).toEqual({ course: null });
        expect(harness.requests).toHaveLength(0);
    });

    it('returns null course info for an unknown course', async () => {
        const { harness, nouTools } = await setup([
            courseListRoute(
                'https://uu.nou.edu.tw',
                'live-sessions-calendar-info.my-course-list',
            ),
            ...nouToolsRoutes('live-sessions-calendar-info'),
        ]);
        await seedSession(harness, {
            username: 's123',
            baseUrl: 'https://uu.nou.edu.tw',
            displayName: '測試',
        });

        expect(await nouTools.courseInfo('nope')).toEqual({ course: null });
    });
});

// Ported from tests/Feature/Course/NouToolsIntegrationTest.php
describe('nou-tools live sessions across accounts', () => {
    async function twoAccounts() {
        const setupResult = await setup([
            courseListRoute(
                'https://uu-a.nou.edu.tw',
                'all-accounts-live-sessions.account-a.my-course-list',
            ),
            courseListRoute(
                'https://uu-b.nou.edu.tw',
                'all-accounts-live-sessions.account-b.my-course-list',
            ),
            [
                `${NOU_TOOLS}/courses/1234`,
                {
                    body: loadFixtureJson(
                        'nou-tools',
                        'all-accounts-live-sessions.course-detail-1234',
                    ),
                },
            ],
            [
                `${NOU_TOOLS}/courses/4321`,
                {
                    body: loadFixtureJson(
                        'nou-tools',
                        'all-accounts-live-sessions.course-detail-4321',
                    ),
                },
            ],
            [
                `${NOU_TOOLS}/courses?term=2025A`,
                {
                    body: loadFixtureJson(
                        'nou-tools',
                        'all-accounts-live-sessions.term-courses',
                    ),
                },
            ],
        ]);
        const first = await seedSession(setupResult.harness, {
            username: 's1111111',
            baseUrl: 'https://uu-a.nou.edu.tw',
            displayName: '主帳號',
        });
        const second = await seedSession(setupResult.harness, {
            username: 's2222222',
            baseUrl: 'https://uu-b.nou.edu.tw',
            displayName: '測試',
            nickname: '副帳號',
        });
        await setupResult.harness.activeProfile.set(first);

        return { ...setupResult, first, second };
    }

    it('lists only the active account by default', async () => {
        const { nouTools, first } = await twoAccounts();
        const sessions = await nouTools.liveSessions();

        expect(sessions).toHaveLength(1);
        expect(sessions[0]).toMatchObject({
            courseId: '1001',
            accountId: first,
        });
    });

    it('merges every account when allAccounts is requested', async () => {
        const { nouTools, first, second } = await twoAccounts();
        const sessions = await nouTools.liveSessions({ allAccounts: true });
        const expected = loadExpected('nou-tools', 'all-accounts-live-sessions')
            .cases[0].expected as Record<string, Record<string, unknown>>;
        const merged = expected['GET live-sessions?allAccounts=1'];

        expect(sessions).toHaveLength(merged.count as number);
        expect(
            sessions.find((session) => session.courseId === '1001'),
        ).toMatchObject({
            accountId: first,
            ...(merged['courseId=1001'] as object),
        });
        expect(
            sessions.find((session) => session.courseId === '2001'),
        ).toMatchObject({
            accountId: second,
            ...(merged['courseId=2001'] as object),
        });
    });

    it('skips accounts without a session and reports failing ones', async () => {
        const { harness, first } = await twoAccounts();
        await harness.credentials.upsert({
            username: 's3333333',
            password: 'x',
        });
        await harness.activeProfile.set(first);
        const errors: unknown[] = [];
        const nouTools = createNouToolsServices({
            fetch: harness.fake.fetch,
            cache: harness.cache,
            credentials: harness.credentials,
            activeAccountId: () => harness.activeProfile.get(),
            hunguSessions: harness.hunguSessions,
            isIntegrationEnabled: async () => true,
            listUserCourses: async (accountId) => {
                if (accountId === first) {
                    throw new Error('boom');
                }

                const { payload } = await harness.course.fetchCourseList(
                    accountId ?? undefined,
                );

                return parseCourses(payload as unknown as HunguCourseList);
            },
            onError: (error) => errors.push(error),
        });

        const sessions = await nouTools.liveSessions({ allAccounts: true });

        expect(sessions.map((session) => session.courseId)).toEqual(['2001']);
        expect(errors).toHaveLength(1);
    });
});

describe('NouToolsClient caching and retry', () => {
    it('caches responses for 14 days and retries a connection failure once', async () => {
        let attempts = 0;
        const { harness, nouTools } = await setup([
            [
                `${NOU_TOOLS}/school-calendar`,
                () => {
                    attempts += 1;

                    return attempts === 1
                        ? new Error('reset')
                        : { body: [{ name: '期中考' }, 'junk'] };
                },
            ],
        ]);

        expect(await nouTools.schoolCalendar()).toEqual([{ name: '期中考' }]);
        expect(attempts).toBe(2);

        await nouTools.schoolCalendar();
        expect(attempts).toBe(2);

        harness.clock.advanceSeconds(13 * 86_400);
        await nouTools.schoolCalendar();
        expect(attempts).toBe(2);

        harness.clock.advanceSeconds(2 * 86_400);
        await nouTools.schoolCalendar();
        expect(attempts).toBe(3);
    });

    it('does not cache a failed detail request', async () => {
        let calls = 0;
        const { nouTools } = await setup([
            [`${NOU_TOOLS}/school-calendar`, { status: 500, body: 'oops' }],
            [
                `${NOU_TOOLS}/courses/*`,
                () => {
                    calls += 1;

                    return { status: 500 };
                },
            ],
        ]);

        expect(await nouTools.schoolCalendar()).toEqual([]);
        expect(await nouTools.client.getCourseDetail(1)).toBeNull();
        expect(await nouTools.client.getCourseDetail(1)).toBeNull();
        expect(calls).toBe(2);
    });
});

describe('course name matching', () => {
    it.each([
        ['114上', '2025A'],
        ['114下', '2025B'],
        ['115暑', '2026C'],
        ['114學年下學期', '2025B'],
        ['115學年暑期', '2026C'],
        ['114上學期', '2025A'],
        [' 114 上 ', '2025A'],
        ['其他', null],
        [null, null],
    ])('normalizes term %j', (semester, expected) => {
        expect(normalizeTermCode(semester)).toBe(expected);
    });

    it('normalizes names across width and punctuation', () => {
        expect(normalizeCourseName('管理學：導論')).toBe(
            normalizeCourseName('管理學導論'),
        );
        expect(normalizeCourseName('ＡＢＣ  Intro!')).toBe('abcintro');
        expect(normalizeCourseName('  ')).toBe('');
    });
});
