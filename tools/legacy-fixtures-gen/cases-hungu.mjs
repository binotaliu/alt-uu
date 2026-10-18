import { fixture } from './lib.mjs';
import crypto from 'node:crypto';

const UU = 'https://uu.nou.edu.tw';
const AF = 'Feature/Auth/AuthFlowTest.php';
const D = 'hungu-transport';
const ok = (data) => ({ code: 0, message: 'success', data });
const loginOk = (ticket, idx, realname) => ok({ session_data: { ticket }, idx_data: { session_idx: idx }, login_data: { realname }, cookie_data: { WM: 'cookie-from-payload' } });

const warm = [
    { name: 'GET /', status: 200, headers: { 'Set-Cookie': 'PHPSESSID=home; path=/' }, body: '<html/>' },
    { name: 'GET /learn/index.php', status: 200, headers: { 'Set-Cookie': 'WMSESSID=learn; path=/' }, body: '<html/>' },
];

fixture({
    domain: D, name: 'login-success', ext: 'json',
    input: { warmup: warm, login: { status: 200, headers: { 'Set-Cookie': 'APPCOOKIE=app; path=/' }, body: loginOk('ticket-1', 'idx-1', '測試學生') }, myProfile: ok({ username: 's1234567', realname: '測試學生', picture: `${UU}/avatar.jpg` }) },
    source: `${AF}:49`, cls: 'App\\Services\\UUProxyClient::login + UUSessionAuthenticator (POST /login)',
    note: 'Upstream exchange for a successful login: warm-up GETs (/ then /learn/index.php, each returns Set-Cookie), then POST /xmlapi/index.php?action=login (form: encrypted username/password + kickOff), then action=my-profile. Golden (kind hungu-login) = UUProxyClient::login() return value {payload, cookies} from the real PHP with these responses.',
    cases: [{ name: 'stores proxy session and remembered credentials after successful login', input: { username: 's1234567', password: 'secret' }, partial: true, expected: { response: { ok: true }, session: { 'hungu.profile.username': 's1234567', 'hungu.profile.display_name': '測試學生', 'hungu.profile.picture': `${UU}/avatar.jpg` }, sessionStorePresent: true, credentialsStorePresent: true, mergedCookies: 'PHPSESSID=home, WMSESSID=learn, APPCOOKIE=app, WM=cookie-from-payload (warm-up, then login response Set-Cookie, then payload data.cookie_data)' } }],
    golden: { kind: 'hungu-login', warmup: warm, login: { status: 200, headers: { 'Set-Cookie': 'APPCOOKIE=app; path=/' }, body: loginOk('ticket-1', 'idx-1', '測試學生') }, username: 's1234567', password: 'secret' },
});
fixture({
    domain: D, name: 'login-failure', ext: 'json',
    input: { code: 503, message: 'Auth fail', data: [] },
    source: `${AF}:23`, cls: 'App\\Services\\UUSessionAuthenticator (POST /login)',
    note: 'Upstream login response body for wrong credentials.',
    cases: [{ name: 'returns error json on invalid login', input: { username: 's1234567', password: 'wrong-password' }, expected: { httpStatus: 422, body: { ok: false, message: '登入失敗，請確認帳號密碼。', raw: { code: 503, message: 'Auth fail', data: [] } } } }],
});
fixture({
    domain: D, name: 'login-uses-session-ticket', ext: 'json',
    input: { login: { status: 200, body: loginOk('ticket-from-session-data', 'idx-should-not-be-used', '測試學生') }, myProfile: ok({ username: 'reviewer', realname: '測試學生', picture: '' }) },
    source: `${AF}:136`, cls: 'App\\Services\\UUSessionAuthenticator',
    note: 'config hungu.reviewer_base_url = https://uu.nou.edu.tw/xmlapi/index.php; username "reviewer".',
    cases: [{ name: 'uses session ticket when fetching profile after login', input: { username: 'reviewer', password: 'secret' }, expected: { response: { ok: true }, myProfileRequestQuery: { 'ticket': 'ticket-from-session-data', notTicket: 'idx-should-not-be-used' } } }],
});
fixture({
    domain: D, name: 'my-profile-success', ext: 'json',
    input: ok({ username: 's1234567', realname: '測試學生', picture: `${UU}/avatar.jpg` }),
    source: `${AF}:69`, cls: 'App\\Services\\UUProfileSession',
    cases: [{ name: 'my-profile response shape', expected: { username: 's1234567', displayName: '測試學生', picture: `${UU}/avatar.jpg` } }],
});
fixture({
    domain: D, name: 'bootstrap-remembered-relogin', ext: 'json',
    input: {
        myProfileSequence: [{ code: 503, message: 'Auth fail', data: [] }, ok({ username: 's1234567', realname: '測試學生', picture: `${UU}/avatar.jpg` })],
        warmup: warm, login: { status: 200, body: loginOk('ticket-relogin', 'idx-relogin', '測試學生') },
        storedSession: { base_url: UU, ticket: 'ticket-expired', session_idx: 'idx-expired', cookies: { WMSESSID: 'cookie-expired' }, profile: { display_name: '過期使用者', username: 's1234567', picture: '', realname: '過期使用者' } },
    },
    source: `${AF}:298`, cls: 'App\\Services\\UUSessionAuthenticator::attemptRememberedLogin (POST /api/auth/bootstrap-session)',
    note: 'Stored session is expired: first my-profile returns code 503, remembered credentials (s1234567 / remembered-secret) re-login, second my-profile succeeds.',
    cases: [
        { name: 'tries remembered credentials when bootstrap api cannot validate current session', partial: true, expected: { response: { ok: true, redirect: '/courses' }, appBootCookieSet: true, 'hungu.profile.username': 's1234567', storedSessionProfileUsername: 's1234567' } },
        { name: 'returns unauthorized when bootstrap api validation and remembered login both fail', input: { myProfile: { code: 503, message: 'Auth fail', data: [] }, login: { code: 403, message: 'invalid account', data: [] } }, partial: true, expected: { response: { ok: true, redirect: '/login', nouToolsIntegrationEnabled: false }, sessionMissing: 'hungu.profile', storedSessionCleared: true, rememberedCredentialsCleared: true } },
    ],
});
fixture({
    domain: D, name: 'reauth-retry-403', ext: 'json',
    input: { responses: [{ status: 403, body: { code: 401 } }, { status: 200, body: { code: 0, data: { ok: true } } }], session: { base_url: 'https://example.com/xmlapi/index.php', ua: 'test-agent', ticket: 'ticket-1', session_idx: '', cookies: [] } },
    source: 'Unit/UUProxyClientTest.php:12', cls: 'App\\Services\\UUProxyClient::request (reauthentication handler)',
    note: 'Http::fakeSequence: first reply 403 {code:401}; second 200 {code:0,data:{ok:true}}. request("my-course-list").',
    cases: [
        { name: 'retries request once after 403 when reauthentication succeeds', input: { reauthHandlerReturns: true, responses: 2 }, expected: { reauthAttempted: true, 'result.payload.code': 0, 'result.payload.data.ok': true } },
        { name: 'does not retry after 403 when reauthentication fails', input: { reauthHandlerReturns: false, responses: 1 }, expected: { reauthAttempted: true, 'result.payload.code': 401 } },
    ],
});
fixture({
    domain: D, name: 'school-portal-base-url-routing', ext: 'json',
    input: { config: { 'school_portal.base_url': 'https://nouapp.nou.edu.tw', 'school_portal.reviewer_username': 'reviewer', 'school_portal.reviewer_base_url': 'https://alt-uu-staging.binota.org' }, loginResponseHeaders: { 'Set-Cookie': 'sid=abc' } },
    source: 'Unit/SchoolPortalProxyClientTest.php:20', cls: 'App\\Services\\SchoolPortalProxyClient',
    cases: [
        { name: 'routes login for a reviewer-prefixed username to the reviewer base url', input: { call: "login('reviewer2', 'anypass')" }, expected: { requestPrefix: 'https://alt-uu-staging.binota.org', neverSentTo: 'https://nouapp.nou.edu.tw' } },
        { name: 'routes login for a non-reviewer username to the real base url', input: { call: "login('student123', 'anypass')" }, expected: { requestPrefix: 'https://nouapp.nou.edu.tw', neverSentTo: 'https://alt-uu-staging.binota.org' } },
        { name: 'routes the first fetch (no existing session) to the reviewer base url when remembered credentials belong to the reviewer', input: { call: "fetchHtmlPage('/device/compliant/qryscore/index')", portalSession: null, rememberedCredentials: { username: 'reviewer', password: 'p' } }, expected: { requestPrefix: 'https://alt-uu-staging.binota.org' } },
        { name: 'routes the first fetch (no existing session) to the real base url when remembered credentials are not the reviewer', input: { call: "fetchHtmlPage('/device/compliant/qryscore/index')", portalSession: null, rememberedCredentials: { username: 'student123', password: 'p' } }, expected: { requestPrefix: 'https://nouapp.nou.edu.tw' } },
    ],
});
fixture({
    domain: D, name: 'session-authenticator-remembered-login',
    source: 'Unit/UUSessionAuthenticatorTest.php:17', cls: 'App\\Services\\UUSessionAuthenticator::attemptRememberedLogin',
    note: 'No payload; behavioural contract.',
    cases: [{ name: 'syncs current course when reauthentication succeeds', input: { activeAccountId: 42, rememberedCredentials: { username: 'u', password: 'p' }, attemptLogin: { ok: true, message: '' }, sessionCurrentCourse: { 'hungu.current_course_id.42': '10050266' } }, expected: { result: true, syncCurrentCourseCalledWith: { cid: '10050266', force: true } } }],
});
