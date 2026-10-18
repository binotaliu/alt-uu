import { fixture } from './lib.mjs';

const UU = 'https://uu.nou.edu.tw';
const NT = 'https://nou-tools.binota.org/api/v1';
const N = 'Feature/Course/NouToolsIntegrationTest.php';
const ntCls = 'AltUU\\Domains\\Course\\Actions\\GetNouToolsCourseData (+ NouTools live sessions/calendar actions)';
const ok = (data) => ({ code: 0, message: 'success', data });
const classObj = (o) => ({ id: 1, code: 'ZZZ001', type: 'morning', typeLabel: '上午班', startTime: '09:00:00+08:00', endTime: '10:50:00+08:00', teacherName: '測試教師甲', link: 'https://meet.example.com/abc-defg-hij', sessions: [{ date: '2025-10-12', startTime: '09:00:00+08:00', endTime: '10:50:00+08:00' }], ...o });

// ---- nou-tools
const mainDetail = {
    id: 1234, name: '管理學導論', term: '2025A', descriptionUrl: 'https://example.com/course/1234', creditType: '必修', credits: 3, department: '假學系', nature: '專業科目',
    midtermDate: '2025-11-15', finalDate: '2026-01-10', examTimeStart: '09:00:00+08:00', examTimeEnd: '10:30:00+08:00',
    textbook: { bookTitle: '管理學概論', edition: '第三版', priceInfo: 'NT$450', referenceUrl: 'https://example.com/book/123' },
    previousExams: [{ term: '2024B', midtermReferencePrimary: 'https://example.com/exams/midterm-a.pdf', midtermReferenceSecondary: null, finalReferencePrimary: 'https://example.com/exams/final-a.pdf', finalReferenceSecondary: null }],
    classes: [classObj({ id: 5566 })],
};
const ntFakes = (n, courseId, term) => [
    { match: `${NT}/courses/${courseId}`, file: `${n}.course-detail.json` },
    { match: `${NT}/courses?term=${term}`, file: `${n}.term-courses.json` },
];
fixture({
    domain: 'nou-tools', name: 'live-sessions-calendar-info',
    inputs: [
        { suffix: 'my-course-list', ext: 'json', content: ok({ list: [{ course_id: '1001', title: '(114上)管理學：導論-ZZZ001班' }] }) },
        { suffix: 'course-detail', ext: 'json', content: mainDetail },
        { suffix: 'term-courses', ext: 'json', content: [{ id: 1234, name: '管理學導論', term: '2025A' }] },
        { suffix: 'school-calendar', ext: 'json', content: [{ name: '期中考', startDate: '2025-11-15', endDate: '2025-11-16', isCountdown: true }] },
    ],
    source: `${N}:43`, cls: ntCls,
    note: 'Upstream: UU my-course-list, nou-tools GET /courses/1234, /courses?term=2025A, /school-calendar. Requires preference nou-tools-integration enabled.',
    cases: [{ name: 'returns mapped nou tools live sessions, school calendar, and course info', partial: true, expected: {
        'GET /api/nou-tools/live-sessions': { count: 1, '0': { courseId: '1001', classCode: 'ZZZ001', 'sessions[0].date': '2025-10-12' } },
        'GET /api/nou-tools/school-calendar': { count: 1, '0.name': '期中考' },
        'GET /api/courses/1001/nou-tools-info': { 'course.nouToolsCourseId': 1234, 'course.department': '假學系', 'course.previousExams[0].term': '2024B' },
        requests: { someUrlContains: 'term=2025A' },
    } }],
    golden: { kind: 'endpoint', nouTools: true, calls: [
        { name: 'live-sessions', method: 'GET', path: '/api/nou-tools/live-sessions' },
        { name: 'school-calendar', method: 'GET', path: '/api/nou-tools/school-calendar' },
        { name: 'nou-tools-info', method: 'GET', path: '/api/courses/1001/nou-tools-info' },
    ], fakes: [{ match: `${UU}/xmlapi/index.php?action=my-course-list*`, file: 'live-sessions-calendar-info.my-course-list.json' }, ...ntFakes('live-sessions-calendar-info', 1234, '2025A'), { match: `${NT}/school-calendar`, file: 'live-sessions-calendar-info.school-calendar.json' }] },
});

const variant = (name, line, testName, courseId, title, detailId, term, detailName, klass, expected) =>
    fixture({
        domain: 'nou-tools', name,
        inputs: [
            { suffix: 'my-course-list', ext: 'json', content: ok({ list: [{ course_id: courseId, title }] }) },
            { suffix: 'course-detail', ext: 'json', content: { id: detailId, name: detailName, term, previousExams: [], classes: [klass] } },
            { suffix: 'term-courses', ext: 'json', content: [{ id: detailId, name: detailName, term }] },
        ],
        source: `${N}:${line}`, cls: ntCls,
        cases: [{ name: testName, partial: true, expected }],
        golden: { kind: 'endpoint', nouTools: true, path: '/api/nou-tools/live-sessions', fakes: [{ match: `${UU}/xmlapi/index.php?action=my-course-list*`, file: `${name}.my-course-list.json` }, ...ntFakes(name, detailId, term)] },
    });

variant('live-sessions-undivided-no-suffix', 254, "falls back to the undivided 不分班 class when no class code matches and the course title has no class suffix", '2002', '(115暑)通識課程', 5678, '2026C', '通識課程',
    classObj({ id: 9001, code: '不分班', type: 'full_remote', typeLabel: '不分班', startTime: '19:00:00+08:00', endTime: '21:00:00+08:00', teacherName: '測試教師丙', link: 'https://meet.example.com/undivided-room', backupClassroomUrl: 'https://meet.example.com/backup-room', sessions: [{ date: '2026-07-20', startTime: '19:00:00+08:00', endTime: '21:00:00+08:00' }] }),
    { count: 1, '0': { courseId: '2002', className: '不分班', classCode: '不分班', link: 'https://meet.example.com/undivided-room', backupClassroomUrl: 'https://meet.example.com/backup-room', 'sessions[0].date': '2026-07-20' } });
variant('live-sessions-undivided-display-name', 327, 'displays 不分班 instead of the UU-provided class name when the matched class is undivided', '2003', '(115暑)通識課程-ZZZ999班', 5679, '2026C', '通識課程',
    classObj({ id: 9002, code: '不分班', type: 'full_remote', typeLabel: '全遠距', startTime: '19:00:00+08:00', endTime: '21:00:00+08:00', teacherName: '測試教師丙', link: 'https://meet.example.com/undivided-room', backupClassroomUrl: null, sessions: [{ date: '2026-07-20', startTime: '19:00:00+08:00', endTime: '21:00:00+08:00' }] }),
    { count: 1, '0': { courseId: '2003', className: '不分班', classCode: '不分班' } });
variant('live-sessions-unified-zzz000', 397, "uses the sole ZZZ000 class for 統一面授 courses regardless of the student's own class", '3001', '(114上)教育心理學-ZZZ003班', 6789, '2025A', '教育心理學',
    classObj({ id: 7001, code: 'ZZZ000', type: 'in_person', typeLabel: '統一面授', startTime: '19:00:00+08:00', endTime: '21:00:00+08:00', teacherName: '測試教師乙', link: 'https://meet.example.com/unified-room', sessions: [{ date: '2025-10-05', startTime: '19:00:00+08:00', endTime: '21:00:00+08:00' }] }),
    { count: 1, '0': { courseId: '3001', classCode: 'ZZZ000', link: 'https://meet.example.com/unified-room', 'sessions[0].date': '2025-10-05' } });

fixture({
    domain: 'nou-tools', name: 'all-accounts-live-sessions',
    inputs: [
        { suffix: 'account-a.my-course-list', ext: 'json', content: ok({ list: [{ course_id: '1001', title: '(114上)管理學：導論-ZZZ001班' }] }) },
        { suffix: 'account-b.my-course-list', ext: 'json', content: ok({ list: [{ course_id: '2001', title: '(114上)會計學：入門-YYY001班' }] }) },
        { suffix: 'course-detail-1234', ext: 'json', content: { id: 1234, name: '管理學導論', term: '2025A', previousExams: [], classes: [classObj({ id: 5566 })] } },
        { suffix: 'course-detail-4321', ext: 'json', content: { id: 4321, name: '會計學入門', term: '2025A', previousExams: [], classes: [classObj({ id: 6677, code: 'YYY001', type: 'evening', typeLabel: '晚間班', startTime: '19:00:00+08:00', endTime: '20:50:00+08:00', teacherName: '測試教師乙', link: 'https://meet.example.com/xyz-uvwt-rst', sessions: [{ date: '2025-10-13', startTime: '19:00:00+08:00', endTime: '20:50:00+08:00' }] })] } },
        { suffix: 'term-courses', ext: 'json', content: [{ id: 1234, name: '管理學導論', term: '2025A' }, { id: 4321, name: '會計學入門', term: '2025A' }] },
    ],
    source: `${N}:156`, cls: ntCls,
    note: 'Two accounts: s1111111 (base https://uu-a.nou.edu.tw, label 主帳號) and s2222222 (base https://uu-b.nou.edu.tw, nickname 副帳號). Course list for account-a/b is served from each base URL. No golden: needs multi-account setup.',
    cases: [{ name: 'merges live sessions from every account when allAccounts is requested', partial: true, expected: { 'GET live-sessions (active account a)': { count: 1, '0.courseId': '1001', '0.accountId': '<account a id>' }, 'GET live-sessions?allAccounts=1': { count: 2, "courseId=1001": { accountLabel: '主帳號' }, "courseId=2001": { accountLabel: '副帳號' } } } }],
});

fixture({
    domain: 'nou-tools', name: 'preference',
    cases: [{ name: 'stores nou tools integration preference', partial: true, expected: { initial: { nouToolsIntegrationEnabled: false }, afterPatchTrue: { nouToolsIntegrationEnabled: true }, keyValueRow: { key: 'preference:nou-tools-integration', value: '{"enabled":true}' } } }],
    source: `${N}:24`, cls: 'AltUU\\Domains\\AppPreference (GET/PATCH /api/preferences)',
});

// ---- app-status
const S = 'Feature/AppStatus/AppStatusControllerTest.php';
const feed = (o = {}) => ({ latest: { ios: '1.0.0', android: '1.0.0' }, minSupported: { ios: '1.0.0', android: '1.0.0' }, storeUrl: { ios: 'https://apps.apple.com/app/alt-uu', android: 'https://play.google.com/store/apps/details?id=alt.uu' }, announcements: [], ...o });
const ann = (o = {}) => ({ id: 'video-stall', severity: 'warning', title: '部分影片無法播放', body: '我們正在處理中', ...o });
const NONE = { update: null, announcements: [] };
const sc = (name, line, f, ctx, expected, extra = {}) => ({ name, line, feed: f, context: { appVersion: '1.0.0', platform: 'ios', now: null, dismissals: [], ...ctx }, expected, ...extra });
const scenarios = [
    sc('returns nothing when the feed has nothing to show', 72, feed(), {}, NONE, { exact: true }),
    sc('returns nothing when the feed is unreachable', 80, null, {}, NONE, { exact: true, feedHttpStatus: 500 }),
    sc('offers an update when a newer version is out', 88, feed({ latest: { ios: '1.2.0', android: '1.2.0' } }), {}, { 'update': { dismissKey: 'update:1.2.0', latestVersion: '1.2.0', storeUrl: 'https://apps.apple.com/app/alt-uu', required: false } }),
    sc('uses the android entries on android', 101, feed({ latest: { ios: '1.0.0', android: '1.3.0' } }), { platform: 'android' }, { 'update.latestVersion': '1.3.0', 'update.storeUrl': 'https://play.google.com/store/apps/details?id=alt.uu' }),
    sc('does not offer an update when already on the latest version (1.2.0)', 110, feed({ latest: { ios: '1.2.0', android: '1.2.0' } }), { appVersion: '1.2.0' }, { update: null }),
    sc('does not offer an update when newer than the latest version (1.3.0)', 110, feed({ latest: { ios: '1.2.0', android: '1.2.0' } }), { appVersion: '1.3.0' }, { update: null }),
    sc('never offers an update to builds without a release number', 117, feed({ latest: { ios: '9.0.0', android: '9.0.0' } }), { appVersion: 'DEBUG' }, { update: null }),
    sc('drops a store url that is not https', 124, feed({ latest: { ios: '1.2.0' }, storeUrl: { ios: 'javascript:alert(1)' } }), {}, { 'update.storeUrl': null }),
    sc('marks an update required below the minimum supported version', 133, feed({ latest: { ios: '1.2.0' }, minSupported: { ios: '1.1.0' } }), {}, { 'update.required': true }),
    sc('remembers a dismissed update only until the next release (dismissed 1.2.0 -> hidden)', 142, feed({ latest: { ios: '1.2.0' } }), { dismissals: ['update:1.2.0'] }, { update: null }, { note: 'POST /api/app-status/dismissals {dismissKey:"update:1.2.0"} -> 201 and update null; later GET still null' }),
    sc('remembers a dismissed update only until the next release (new release 1.3.0 shows again)', 142, feed({ latest: { ios: '1.3.0' } }), { dismissals: ['update:1.2.0'], cacheFlushedBeforeFeed: true }, { 'update.latestVersion': '1.3.0' }),
    sc('keeps showing a required update after it was dismissed', 157, feed({ latest: { ios: '1.2.0' }, minSupported: { ios: '1.2.0' } }), { dismissals: ['update:1.2.0'] }, { 'update.required': true }),
    sc('lists announcements with sensible defaults', 167, feed({ announcements: [ann({ url: 'https://alt-uu-statics.pages.dev/changelog.html#video' }), ann({ id: 'plain', severity: 'bogus', body: null, title: '簡單公告' })] }), {}, { announcementsCount: 2, 'announcements[0]': { dismissKey: 'announcement:video-stall', severity: 'warning', title: '部分影片無法播放', body: '我們正在處理中', url: 'https://alt-uu-statics.pages.dev/changelog.html#video', dismissible: true }, 'announcements[1].severity': 'info', 'announcements[1].body': '', 'announcements[1].url': null }),
    sc('skips malformed announcements without failing the rest', 191, feed({ announcements: ['not-an-object', ann({ id: '' }), ann({ title: '' }), ann({ id: 'good' })] }), {}, { announcementsCount: 1, 'announcements[0].dismissKey': 'announcement:good' }),
    sc('filters announcements by platform', 206, feed({ announcements: [ann({ id: 'ios-only', platforms: ['ios'] }), ann({ id: 'android-only', platforms: ['android'] }), ann({ id: 'everyone', platforms: [] })] }), {}, { announcementsCount: 2, 'announcements[0].dismissKey': 'announcement:ios-only', 'announcements[1].dismissKey': 'announcement:everyone' }),
    sc('filters announcements by version range', 221, feed({ announcements: [ann({ id: 'in-range', minVersion: '1.0.0', maxVersion: '1.1.0' }), ann({ id: 'too-new-needed', minVersion: '1.2.0' }), ann({ id: 'fixed-already', maxVersion: '1.0.2' })] }), { appVersion: '1.1.0' }, { announcementsCount: 1, 'announcements[0].dismissKey': 'announcement:in-range' }),
    sc('hides expired announcements and those with an unreadable expiry', 236, feed({ announcements: [ann({ id: 'live', expires: '2026-10-15T00:00:00+08:00' }), ann({ id: 'expired', expires: '2026-09-30T00:00:00+08:00' }), ann({ id: 'typo', expires: 'next tuesday-ish' }), ann({ id: 'no-expiry' })] }), { now: '2026-10-01T00:00:00+08:00' }, { announcementsCount: 2, 'announcements[0].dismissKey': 'announcement:live', 'announcements[1].dismissKey': 'announcement:no-expiry' }),
    sc('hides a dismissed announcement but not one marked non-dismissible', 253, feed({ announcements: [ann({ id: 'closable' }), ann({ id: 'sticky', dismissible: false })] }), { dismissals: ['announcement:closable', 'announcement:sticky'] }, { announcementsCount: 1, 'announcements[0].dismissKey': 'announcement:sticky', 'announcements[0].dismissible': false }),
];
fixture({
    domain: 'app-status', name: 'status-feed-scenarios', ext: 'json',
    input: scenarios.map(({ name, feed: f, context, feedHttpStatus }) => ({ name, feed: f, ...(feedHttpStatus ? { feedHttpStatus } : {}), context })),
    source: `${S}:72-268`, cls: 'AltUU\\Domains\\AppStatus\\Actions\\GetAppStatus, DismissAppStatusItem (GET/POST /api/app-status*)',
    note: 'Each entry = statics feed (https://statics.test/status.json; feed null means HTTP 500 "boom") + context (appVersion=nativephp.version, platform, now, dismissals = dismissKeys POSTed beforehand). Config: services.statics.base_url=https://statics.test.',
    cases: scenarios.map((s) => ({ name: s.name, input: { scenarioIndexOrName: s.name, context: s.context, ...(s.note ? { note: s.note } : {}) }, ...(s.exact ? {} : { partial: true }), expected: s.expected })),
    golden: { kind: 'app-status', file: 'status-feed-scenarios.json' },
});
fixture({
    domain: 'app-status', name: 'status-feed-behaviours',
    source: `${S}:270-294`, cls: 'AltUU\\Domains\\AppStatus\\AppStatusFeedClient / DismissAppStatusItem',
    note: 'Behavioural cases that cannot be a static scenario.',
    cases: [
        { name: 'rejects dismissal keys of an unknown kind', input: { dismissKeys: ['', 'whatever', 'update:', 'a'.repeat(200)] }, expected: { httpStatus: 422 } },
        { name: 'serves the feed from cache instead of refetching', input: { requests: 'GET /api/app-status twice' }, expected: { feedHttpRequestCount: 1 } },
        { name: 'falls back to the last good feed and backs off while the feed is down', input: { steps: ['feed OK with 1 announcement -> GET shows 1', 'forget cache key app-status:feed; feed now 503 "down"', 'GET twice -> still shows 1 announcement'] }, expected: { announcementsCount: 1, feedHttpRequestCount: 1, note: 'the failing fetch is not retried on the second GET (backoff)' } },
    ],
});

// ---- study-time
const ST = 'Feature/StudyTime/StudyTimeTest.php';
const ST_CLS = 'AltUU\\Domains\\StudyTime (POST /study-time, playback progress)';
const timeFakes = { serverTime: ok({ server_time: '2026-03-14 10:00:00' }), uploadOk: ok({ seconds: 120 }) };
fixture({
    domain: 'study-time', name: 'upload-success', ext: 'json',
    input: { request: { cid: '1001', activityId: 'N-1', url: `${UU}/material/lesson-1.html`, seconds: 120, positionSeconds: 42.5, mediaDurationSeconds: 755.4 }, upstream: { 'get-server-time': timeFakes.serverTime, 'set-read-node-history': timeFakes.uploadOk }, preexistingCache: { key: 'alt-uu:courses:path-info:<accountId>:1001', value: { cached: true } } },
    source: `${ST}:18`, cls: ST_CLS,
    cases: [{ name: 'uploads reading time through proxy endpoint and stores playback progress', expected: { response: { ok: true, seconds: 120 }, pathInfoCacheForCourseCleared: true, playbackProgressRow: { cid: '1001', activity_id: 'N-1', duration_seconds: 120, position_seconds: 42.5, media_duration_seconds: 755.4, hungu_upload_success: true }, upstreamUpload: { action: 'set-read-node-history', contentType: 'application/x-www-form-urlencoded', form: { cid: '1001', url: `${UU}/material/lesson-1.html`, st: '2026-03-14 09:58:00', activity_id: 'N-1' }, note: 'st = server_time minus seconds' } } }],
});
fixture({
    domain: 'study-time', name: 'daily-activity-accumulates', ext: 'json',
    input: { requests: [{ cid: '1001', activityId: 'N-1', url: `${UU}/material/lesson-1.html`, seconds: 120 }, { cid: '1001', activityId: 'N-2', url: `${UU}/material/lesson-2.html`, seconds: 90 }], upstream: { 'get-server-time': timeFakes.serverTime, 'set-read-node-history': timeFakes.uploadOk } },
    source: `${ST}:95`, cls: ST_CLS,
    cases: [{ name: 'accumulates seconds into the daily activity log across multiple sessions', expected: { accountDailyActivity: { activity_date: "today in Asia/Taipei (YYYY-MM-DD)", total_seconds: 210 } } }],
});
fixture({
    domain: 'study-time', name: 'upload-retry-with-et', ext: 'json',
    input: { request: { cid: '1001', activityId: 'N-1', url: `${UU}/material/lesson-1.html`, seconds: 120 }, upstream: { 'get-server-time': timeFakes.serverTime, 'set-read-node-history': [{ code: 500, message: 'failed' }, ok({ seconds: 120 })] } },
    source: `${ST}:145`, cls: ST_CLS,
    note: 'set-read-node-history replies with the array in order (sequence).',
    cases: [{ name: 'retries study time upload with et when first attempt fails', expected: { response: { ok: true, seconds: 120 }, uploadRequestCount: 2, firstUploadForm: { cid: '1001', url: `${UU}/material/lesson-1.html`, st: '2026-03-14 09:58:00', activity_id: 'N-1' }, secondUploadFormHasKeys: ['cid', 'url', 'st', 'activity_id', 'et'] } }],
});
fixture({
    domain: 'study-time', name: 'rotated-cookie-reuse', ext: 'json',
    input: { request: { cid: '1001', activityId: 'N-1', url: `${UU}/material/lesson-1.html`, seconds: 120 }, session: { base_url: UU, ua: 'test-agent', ticket: 'ticket-1', session_idx: 'idx-1', cookies: { WM: 'stale-cookie' } }, upstream: { 'get-server-time': { status: 200, headers: { 'Set-Cookie': 'WM=rotated-cookie; path=/' }, body: timeFakes.serverTime }, 'set-read-node-history': timeFakes.uploadOk } },
    source: `${ST}:206`, cls: ST_CLS,
    cases: [{ name: 'uses updated hungu cookies for subsequent proxy calls in the same request', expected: { response: { ok: true }, uploadRequestCookieHeaderContains: 'WM=rotated-cookie', uploadRequestCookieHeaderNotContains: 'WM=stale-cookie' } }],
});
fixture({
    domain: 'study-time', name: 'playback-progress-api', ext: 'json',
    input: { accounts: ['active', 'other'], playbackProgressRows: [{ account: 'active', cid: '1001', activity_id: 'N-1', duration_seconds: 120, position_seconds: 42.5, hungu_upload_success: true }, { account: 'other', cid: '1001', activity_id: 'N-1', duration_seconds: 999, position_seconds: 1.0, hungu_upload_success: false }] },
    source: `${ST}:266`, cls: ST_CLS,
    cases: [{ name: 'returns playback progress via API endpoint', input: { request: 'GET /api/playback-progress/1001/N-1' }, partial: true, expected: { progress: { cid: '1001', activityId: 'N-1', studySeconds: 120, positionSeconds: 42.5, hunguUploadSuccess: true }, progressMissingKeys: ['activity_id', 'duration_seconds', 'position_seconds', 'hungu_upload_success'] } }],
});
fixture({
    domain: 'study-time', name: 'last-seen-material', ext: 'json',
    input: { accounts: ['active', 'other'], playbackProgressRows: [{ account: 'active', cid: '1001', activity_id: 'N-1', duration_seconds: 60, position_seconds: 10, hungu_upload_success: true, updated_at: 'now - 10 minutes' }, { account: 'active', cid: '1001', activity_id: 'N-2', duration_seconds: 30, position_seconds: 5, media_duration_seconds: 755, hungu_upload_success: true, updated_at: 'now' }, { account: 'other', cid: '1001', activity_id: 'N-3', duration_seconds: 999, position_seconds: 1, hungu_upload_success: false }] },
    source: `${ST}:317`, cls: ST_CLS,
    cases: [
        { name: 'returns the most recently updated activity id as last seen material', input: { request: 'GET /api/courses/1001/last-seen-material' }, partial: true, expected: { activityId: 'N-2', positionSeconds: 5, mediaDurationSeconds: 755 } },
        { name: 'returns null activity id when there is no playback progress for the course', input: { playbackProgressRows: [], request: 'GET /api/courses/1001/last-seen-material' }, partial: true, expected: { activityId: null, positionSeconds: null, mediaDurationSeconds: null } },
    ],
});

// ---- data portability
const DP = 'Feature/DataPortability/DataExportImportTest.php';
const DPC = 'AltUU\\Domains\\DataPortability\\Actions\\ExportAccountData / ImportAccountData / MergeAccountData';
fixture({
    domain: 'data-portability', name: 'export-sample',
    cls: DPC, source: `${DP}:64-100`,
    cases: [
        { name: 'allows export without an active subscription', input: { accounts: ['s1111111'] }, expected: { httpOk: true } },
        { name: 'exports accounts, playback progress, and daily activity keyed by username', input: { accounts: ['s2222222'], subscription: 'active', playbackProgress: { cid: '1001', activity_id: 'N-1', duration_seconds: 120, position_seconds: 42.5, hungu_upload_success: true }, dailyActivity: { activity_date: '2026-07-10', total_seconds: 900 } }, partial: true, expected: { header: 'Content-Disposition present', 'accounts.s2222222': '<local account id>', 'playbackProgress[0]': { username: 's2222222', cid: '1001' }, 'accountDailyActivities[0]': { username: 's2222222', totalSeconds: 900 } } },
    ],
    note: 'Golden (export-sample.golden.json) = full real export JSON from the PHP action for the second case (account s2222222, ids/timestamps are whatever the in-memory DB produced).',
    golden: { kind: 'data-export' },
});
const importMatched = {
    accounts: { s4444444: 999, 'unknown-user': 111 },
    playbackProgress: [
        { username: 's4444444', cid: '1002', activityId: 'N-2', durationSeconds: 300, positionSeconds: 10.5, hunguUploadSuccess: false },
        { username: 'unknown-user', cid: '9999', activityId: 'N-9', durationSeconds: 100, positionSeconds: 1.0, hunguUploadSuccess: null },
    ],
    accountDailyActivities: [{ username: 's4444444', activityDate: '2026-07-09', totalSeconds: 600 }],
};
fixture({
    domain: 'data-portability', name: 'import-matched-and-unknown', ext: 'json', input: importMatched,
    cls: DPC, source: `${DP}:114`,
    note: 'POST /api/data-export/import body. Local account s4444444 exists; "unknown-user" does not. Golden = the PHP response.',
    cases: [{ name: 'imports matched accounts and skips usernames with no local account', input: { localAccounts: ['s4444444'], subscription: 'active' }, expected: { importedAccountsCount: 1, skippedUsernames: ['unknown-user'], importedPlaybackProgressCount: 1, importedAccountDailyActivitiesCount: 1, db: { 'playback_progress(account s4444444, cid 1002)': 1, 'playback_progress(cid 9999)': 0, 'account_daily_activities(2026-07-09).total_seconds': 600 } } }],
    golden: { kind: 'data-import', payloadFile: 'import-matched-and-unknown.json', username: 's4444444' },
});
fixture({
    domain: 'data-portability', name: 'import-idempotent', ext: 'json',
    input: { accounts: { s5555555: 1 }, playbackProgress: [{ username: 's5555555', cid: '1003', activityId: 'N-3', durationSeconds: 50, positionSeconds: 5.0, hunguUploadSuccess: true }], accountDailyActivities: [{ username: 's5555555', activityDate: '2026-07-08', totalSeconds: 200 }] },
    cls: DPC, source: `${DP}:160`,
    note: 'Imported twice in a row; must not duplicate rows.',
    cases: [{ name: 'does not duplicate rows when the same data is imported twice', input: { localAccounts: ['s5555555'], subscription: 'active', importTimes: 2 }, expected: { 'playback_progress(cid 1003) count': 1, 'account_daily_activities(2026-07-08) count': 1 } }],
    golden: { kind: 'data-import', payloadFile: 'import-idempotent.json', username: 's5555555', times: 2 },
});
fixture({
    domain: 'data-portability', name: 'import-requires-subscription', ext: 'json',
    input: { accounts: { s3333333: 1 }, playbackProgress: [], accountDailyActivities: [] },
    cls: DPC, source: `${DP}:102`,
    cases: [{ name: 'rejects import without an active subscription', input: { localAccounts: ['s3333333'], subscription: 'none' }, expected: { httpStatus: 402 } }],
    golden: { kind: 'data-import', payloadFile: 'import-requires-subscription.json', username: 's3333333', subscription: false },
});
