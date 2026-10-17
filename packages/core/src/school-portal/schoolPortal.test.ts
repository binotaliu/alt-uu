import { describe, expect, it } from 'vitest';

import { createFakeFetch, InMemorySessionStore } from '../http/testing';
import type {
    AccountCredentials,
    CredentialsStore,
    SchoolPortalSession,
} from '../session/types';
import { defaultSchoolPortalConfig } from './config';
import { createSchoolPortalServices } from './createSchoolPortalServices';
import { extractAnticsrf } from './schoolPortalProxyClient';

const UA = defaultSchoolPortalConfig.userAgent;

function credentials(value: AccountCredentials | null): CredentialsStore {
    return { get: async () => value, put: async () => {} };
}

function setup(
    routes: Parameters<typeof createFakeFetch>[0],
    remembered: AccountCredentials | null = { username: 's1', password: 'p' },
) {
    const fake = createFakeFetch(routes);
    const sessionStore = new InMemorySessionStore<SchoolPortalSession>(1);
    const services = createSchoolPortalServices({
        fetch: fake.fetch,
        config: defaultSchoolPortalConfig,
        sessionStore,
        credentialsStore: credentials(remembered),
    });

    return { ...services, sessionStore, requests: fake.requests };
}

const loginRoutes = (
    base = 'https://nouapp.nou.edu.tw',
): Parameters<typeof createFakeFetch>[0] => [
    [
        `${base}/device/compliant/login/login*`,
        [
            {
                body: '<form><input type="hidden" name="anticsrf" value="tok&amp;1"></form>',
                setCookies: ['JSESSIONID=pre; Path=/'],
            },
            {
                status: 302,
                headers: { location: '/device/compliant/home/' },
                setCookies: ['JSESSIONID=post; Path=/'],
            },
        ],
    ],
    [
        `${base}/rest/login/session`,
        { body: { response: { user: { userID: 'u1' } } }, setCookies: ['X=1'] },
    ],
];

describe('SchoolPortalProxyClient', () => {
    // Request shapes captured from the legacy client with Http::fake.
    it('logs in with the anti-CSRF token and keeps the cookie from the 302', async () => {
        const { proxy, sessionStore, requests } = setup(loginRoutes());

        expect(await proxy.login(' s1 ', 'p w&')).toBe(true);

        expect(
            requests.map((request) => [
                request.method,
                request.url,
                request.redirect,
            ]),
        ).toEqual([
            [
                'GET',
                'https://nouapp.nou.edu.tw/device/compliant/login/login?authority=nou',
                'manual',
            ],
            [
                'POST',
                'https://nouapp.nou.edu.tw/device/compliant/login/login',
                'manual',
            ],
            ['GET', 'https://nouapp.nou.edu.tw/rest/login/session', 'manual'],
        ]);
        expect(requests[0].headers).toEqual({
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            origin: 'https://nouapp.nou.edu.tw',
            referer: 'https://nouapp.nou.edu.tw/device/compliant/home/',
            'user-agent': UA,
        });
        expect(requests[1].headers).toEqual({
            'content-type': 'application/x-www-form-urlencoded',
            cookie: 'JSESSIONID=pre',
            origin: 'https://nouapp.nou.edu.tw',
            referer: 'https://nouapp.nou.edu.tw/device/compliant/home/',
            'user-agent': UA,
        });
        expect(requests[1].body).toBe(
            'startOver=1&anticsrf=tok%261&authority=nou&loginUser=s1&loginPassword=p+w%26&agreeTerm=1',
        );
        expect(requests[2].headers.accept).toBe('application/json');
        expect(requests[2].headers.cookie).toBe('JSESSIONID=post');
        expect(await sessionStore.get()).toEqual({
            baseUrl: 'https://nouapp.nou.edu.tw',
            userAgent: UA,
            cookies: { JSESSIONID: 'post', X: '1' },
        });
    });

    it('fails the login when the session check has no user id', async () => {
        const { proxy, sessionStore } = setup([
            [
                'https://nouapp.nou.edu.tw/rest/login/session',
                { body: { response: { user: { userID: '' } } } },
            ],
            ['*', { body: '' }],
        ]);

        expect(await proxy.login('s1', 'bad')).toBe(false);
        expect(await sessionStore.get()).toBeNull();
    });

    // Ported from tests/Unit/SchoolPortalProxyClientTest.php
    it('routes login for a reviewer-prefixed username to the reviewer base url', async () => {
        const { proxy, requests } = setup([
            [
                'https://alt-uu-staging.binota.org/*',
                { setCookies: ['sid=abc'] },
            ],
        ]);

        await proxy.login('reviewer2', 'anypass');

        expect(requests.length).toBeGreaterThan(0);
        expect(
            requests.every((request) =>
                request.url.startsWith('https://alt-uu-staging.binota.org'),
            ),
        ).toBe(true);
    });

    it('routes login for a non-reviewer username to the real base url', async () => {
        const { proxy, requests } = setup([
            ['https://nouapp.nou.edu.tw/*', { setCookies: ['sid=abc'] }],
        ]);

        await proxy.login('student123', 'anypass');

        expect(
            requests.every((request) =>
                request.url.startsWith('https://nouapp.nou.edu.tw'),
            ),
        ).toBe(true);
    });

    it('routes the first fetch (no existing session) to the reviewer base url when remembered credentials belong to the reviewer', async () => {
        const { proxy, requests } = setup(
            [
                [
                    'https://alt-uu-staging.binota.org/*',
                    { body: '<html></html>' },
                ],
            ],
            { username: 'reviewer', password: 'p' },
        );

        await proxy.fetchHtmlPage('/device/compliant/qryscore/index');

        expect(requests[0].url).toBe(
            'https://alt-uu-staging.binota.org/device/compliant/qryscore/index',
        );
    });

    it('routes the first fetch (no existing session) to the real base url when remembered credentials are not the reviewer', async () => {
        const { proxy, requests } = setup(
            [['https://nouapp.nou.edu.tw/*', { body: '<html></html>' }]],
            { username: 'student123', password: 'p' },
        );

        await proxy.fetchHtmlPage('/device/compliant/qryscore/index');

        expect(requests[0].url).toBe(
            'https://nouapp.nou.edu.tw/device/compliant/qryscore/index',
        );
    });

    it('re-logs in once when a page renders the login form, then retries', async () => {
        const { client, sessionStore, requests } = setup([
            ...loginRoutes(),
            [
                'https://nouapp.nou.edu.tw/device/compliant/qryscore/index',
                [
                    { body: '<input name="loginUser">' },
                    { body: '<table>grades</table>' },
                ],
            ],
        ]);
        await sessionStore.put({
            baseUrl: 'https://nouapp.nou.edu.tw',
            userAgent: UA,
            cookies: { JSESSIONID: 'old' },
        });

        expect(await client.fetchCurrentSemesterGradesPage()).toEqual({
            status: 200,
            body: '<table>grades</table>',
        });
        expect(requests.at(-1)?.headers.cookie).toBe('JSESSIONID=post; X=1');
    });

    it('returns the login page when re-login fails', async () => {
        const { client, requests } = setup(
            [['*', { body: '<input name="loginUser">' }]],
            null,
        );

        expect(await client.fetchExamInfoPage()).toEqual({
            status: 200,
            body: '<input name="loginUser">',
        });
        expect(requests).toHaveLength(1);
    });

    it.each([
        ['fetchHomeworkNoticesPage', '/device/compliant/qryass/index'],
        ['fetchHistoricalGradesPage', '/device/compliant/qryscore2/index'],
        ['fetchClassSessionInfoPage', '/device/compliant/qryper/index'],
    ] as const)('%s fetches %s', async (method, path) => {
        const { client, requests } = setup([['*', { body: 'ok' }]]);

        await client[method]();

        expect(requests[0].url).toBe(`https://nouapp.nou.edu.tw${path}`);
    });

    it('hands downloads off with the session cookie', async () => {
        const { proxy, sessionStore } = setup([]);
        await sessionStore.put({
            baseUrl: 'https://nouapp.nou.edu.tw/',
            userAgent: 'ua',
            cookies: { JSESSIONID: 's' },
        });

        expect(
            await proxy.downloadHandoff('https://nouapp.nou.edu.tw/file.pdf'),
        ).toEqual({
            url: 'https://nouapp.nou.edu.tw/file.pdf',
            headers: {
                'user-agent': 'ua',
                origin: 'https://nouapp.nou.edu.tw',
                referer: 'https://nouapp.nou.edu.tw/device/compliant/home/',
                cookie: 'JSESSIONID=s',
                accept: '*/*',
            },
            baseUrl: 'https://nouapp.nou.edu.tw',
            cookies: { JSESSIONID: 's' },
        });
    });

    it('extracts the anti-CSRF token regardless of attribute order and quoting', () => {
        expect(
            extractAnticsrf(
                "<input value='a&quot;b' type=hidden name=anticsrf>",
            ),
        ).toBe('a"b');
        expect(
            extractAnticsrf(
                '<input name="other" value="x"><input name="anticsrf" value="y">',
            ),
        ).toBe('y');
        expect(extractAnticsrf('<p>none</p>')).toBe('');
        expect(extractAnticsrf('')).toBe('');
    });
});
