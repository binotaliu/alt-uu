import { fixture, hd } from './lib.mjs';

const D = 'course';
const UU = 'https://uu.nou.edu.tw';
const CL = 'Feature/Course';
const goCourse = { match: `${UU}/xmlapi/index.php?action=go-course*`, json: { code: 0, message: 'success', data: [] } };

// ---- ListCourses (Unit/ListCoursesTest.php)
const LC = 'AltUU\\Domains\\Course\\Actions\\ListCourses';
const courseList = (list) => ({ payload: { data: { list } } });
fixture({
    domain: D,
    name: 'list-courses-app-course-type',
    ext: 'json',
    input: { code: 0, data: { list: [{ course_id: '1001', title: '(114下)行動學習導論-ZZZ001班' }, { course_id: '1002', title: '(114下)行動學習導論-語音APP' }] } },
    source: 'Unit/ListCoursesTest.php:13',
    cls: LC,
    note: 'Input is the my-course-list upstream payload (test wraps it as ["payload" => ...]). Legacy asserts only the first item of ListCourses::items().',
    cases: [{
        name: 'populates commonCourseId when courseType comes from an app course',
        partial: true,
        expected: { itemCount: 1, 'items[0]': { courseId: '1001', commonCourseId: '1002', courseType: '語音' }, cacheKeyWritten: 'alt-uu:courses:list:anonymous' },
    }],
    golden: { kind: 'endpoint', path: '/api/courses', fakes: [{ match: `${UU}/xmlapi/index.php?action=my-course-list*`, file: 'list-courses-app-course-type.json' }] },
});
fixture({
    domain: D,
    name: 'list-courses-hyphenated-class',
    ext: 'json',
    input: { code: 0, data: { list: [{ course_id: '2001', title: '(114下)某某課程-台北-測試班' }, { course_id: '2002', title: '(114下)某某課程-語音APP' }] } },
    source: 'Unit/ListCoursesTest.php:61',
    cls: LC,
    cases: [{
        name: 'supports hyphenated class names when matching app course type',
        partial: true,
        expected: { itemCount: 1, 'items[0]': { courseId: '2001', commonCourseId: '2002', courseType: '語音' }, cacheKeyWritten: 'alt-uu:courses:list:anonymous' },
    }],
    golden: { kind: 'endpoint', path: '/api/courses', fakes: [{ match: `${UU}/xmlapi/index.php?action=my-course-list*`, file: 'list-courses-hyphenated-class.json' }] },
});

// ---- Homeworks
const HW = `${CL}/CourseHomeworksApiTest.php`;
const studentId = 's100001';
const hwType = 'personal';
const hwHtml = hd(HW, 19).replaceAll('{$studentId}', studentId).replaceAll('{$type}', hwType);
fixture({
    domain: D,
    name: 'homeworks-uu-list',
    ext: 'html',
    input: hwHtml,
    source: `${HW}:10`,
    cls: 'AltUU\\Domains\\Course\\Actions\\GetCourseHomeworks',
    note: 'Legacy test interpolates random $studentId/$type; this fixture pins studentId=s100001 type=personal. Upstream GET /learn/homework/homework_list.php (after go-course).',
    cases: [{
        name: 'maps course homeworks with action and result urls',
        input: { cid: '1001' },
        partial: true,
        expected: {
            homeworkItemsCount: 2,
            schoolPortalNoticesCount: 0,
            'homeworkItems[0]': { title: '假課程-作業 A', percent: '100%', type: 'homework', status: '進行作業', window: '從 2026-01-01 00:00 到 2026-01-31 23:59', actionUrl: `${UU}/learn/homework/exam_pre_start.php?200001+1+tokenabc+0`, resultUrl: `${UU}/learn/homework/view_exemplar.php?200001+1+tokenabc+${studentId}+${hwType}` },
            'homeworkItems[1]': { title: '假課程-作業 B', percent: '100%', status: '已繳作業', actionUrl: null, resultUrl: null },
            requests: ['go-course with cid=1001', `GET ${UU}/learn/homework/homework_list.php`],
        },
    }],
    golden: { kind: 'endpoint', path: '/api/courses/1001/homeworks', fakes: [goCourse, { match: `${UU}/learn/homework/homework_list.php`, file: 'homeworks-uu-list.html' }] },
});
fixture({
    domain: D,
    name: 'homeworks-school-portal-notices',
    ext: 'html',
    input: hd(HW, 137),
    source: `${HW}:117`,
    cls: 'AltUU\\Domains\\Course\\Actions\\GetCourseHomeworks',
    note: 'qryass portal page (GET /device/compliant/qryass/index). Course list payload: course 9001 "(115暑)假課程乙". Hongu homework_list is empty (<html><body></body></html>).',
    cases: [{
        name: 'returns school portal homework notices alongside the hongu homework list',
        input: { cid: '9001', courseListPayload: { code: 0, data: { list: [{ course_id: '9001', title: '(115暑)假課程乙' }] } } },
        partial: true,
        expected: {
            homeworkItemsCount: 0,
            schoolPortalNoticesCount: 1,
            'schoolPortalNotices[0]': { title: '第1次作業', downloadUrl: 'https://nouapp.nou.edu.tw/device/compliant/qryass/download?type=homework&filename=1153_900001_1&extension=pdf&_b=%5B%5D' },
        },
    }],
    golden: {
        kind: 'endpoint', path: '/api/courses/9001/homeworks', portal: true,
        fakes: [
            goCourse,
            { match: `${UU}/xmlapi/index.php?action=my-course-list*`, json: { code: 0, data: { list: [{ course_id: '9001', title: '(115暑)假課程乙' }] } } },
            { match: `${UU}/learn/homework/homework_list.php`, body: '<html><body></body></html>' },
            { match: 'https://nouapp.nou.edu.tw/device/compliant/qryass/index', file: 'homeworks-school-portal-notices.html' },
        ],
    },
});

// ---- Self exams
const SE = `${CL}/CourseSelfExamsApiTest.php`;
const examA = 'e100001+2+token-AAAA1111';
const examB = 'e100002+1+token-BBBB2222';
const seHtml = hd(SE, 19).replaceAll('{$firstExamId}', examA).replaceAll('{$secondExamId}', examB);
fixture({
    domain: D,
    name: 'self-exams-list',
    ext: 'html',
    input: seHtml,
    source: `${SE}:9`,
    cls: 'AltUU\\Domains\\Course\\Actions\\GetCourseSelfExams',
    note: `Legacy test interpolates random exam ids; pinned here to ${examA} and ${examB}. Upstream GET /learn/exam/co_self_exam_list.php (after go-course).`,
    cases: [{
        name: 'maps self exams with nested retake button and view result urls',
        input: { cid: '4242' },
        partial: true,
        expected: {
            count: 3,
            '0': { title: '示範自我測驗 A', actionUrl: `${UU}/learn/exam/exam_start.php?${examA}+0`, resultUrl: `${UU}/learn/exam/view_result.php?${examA}`, isSubmitted: true, resultUnavailableReason: null },
            '1': { title: '示範自我測驗 B', actionUrl: `${UU}/learn/exam/exam_start.php?${examB}+0`, resultUrl: null, isSubmitted: false, resultUnavailableReason: '繳交後公布' },
            '2': { title: '示範自我測驗 C', resultUrl: null, isSubmitted: true, resultUnavailableReason: '關閉後公布' },
            requests: ['go-course with cid=4242', `GET ${UU}/learn/exam/co_self_exam_list.php`],
        },
    }],
    golden: { kind: 'endpoint', path: '/api/courses/4242/self-exams', fakes: [goCourse, { match: `${UU}/learn/exam/co_self_exam_list.php`, file: 'self-exams-list.html' }] },
});

// ---- Tasks count
const TC = `${CL}/CourseTasksCountApiTest.php`;
const TCCLS = 'AltUU\\Domains\\Course\\Actions\\GetCourseTasksCount';
const empty = '<html><body></body></html>';
fixture({
    domain: D,
    name: 'tasks-count-merged',
    inputs: [
        { suffix: 'homework', ext: 'html', content: hd(TC, 11) },
        { suffix: 'forum', ext: 'html', content: hd(TC, 35) },
    ],
    source: `${TC}:9`,
    cls: TCCLS,
    note: 'Upstream GET /learn/my_homework.php (.homework.html) and /learn/my_forum.php (.forum.html).',
    cases: [{
        name: 'returns merged pending homeworks and unread articles counts',
        expected: [
            { courseId: '10050559', pendingHomeworks: 1, unreadArticles: 0 },
            { courseId: '10048231', pendingHomeworks: 2, unreadArticles: 5 },
            { courseId: '10099999', pendingHomeworks: 0, unreadArticles: 3 },
        ],
    }],
    golden: { kind: 'endpoint', path: '/api/courses/tasks-count', fakes: [{ match: `${UU}/learn/my_homework.php`, file: 'tasks-count-merged.homework.html' }, { match: `${UU}/learn/my_forum.php`, file: 'tasks-count-merged.forum.html' }] },
});
fixture({
    domain: D,
    name: 'tasks-count-malformed',
    inputs: [
        { suffix: 'homework', ext: 'html', content: hd(TC, 126) },
        { suffix: 'forum', ext: 'html', content: empty },
    ],
    source: `${TC}:124`,
    cls: TCCLS,
    note: 'Row without data-bid / enough columns must be skipped.',
    cases: [{ name: 'handles malformed HTML gracefully', expected: [] }],
    golden: { kind: 'endpoint', path: '/api/courses/tasks-count', fakes: [{ match: `${UU}/learn/my_homework.php`, file: 'tasks-count-malformed.homework.html' }, { match: `${UU}/learn/my_forum.php`, file: 'tasks-count-malformed.forum.html' }] },
});
fixture({
    domain: D,
    name: 'tasks-count-empty-and-errors',
    input: empty,
    ext: 'html',
    source: `${TC}:96,165,193`,
    cls: TCCLS,
    note: 'Input is the empty page served for both pages in the first case. Other cases: both pages HTTP 502 "Server Error"; missing hungu session.',
    cases: [
        { name: 'returns empty array when no pending homeworks or unread articles', expected: [] },
        { name: 'handles server errors gracefully', input: { homeworkStatus: 502, forumStatus: 502, body: 'Server Error' }, expected: [] },
        { name: 'requires hungu session', input: { session: null }, expected: { httpStatus: 401 } },
    ],
    golden: { kind: 'endpoint', path: '/api/courses/tasks-count', fakes: [{ match: `${UU}/learn/my_homework.php`, file: 'tasks-count-empty-and-errors.html' }, { match: `${UU}/learn/my_forum.php`, file: 'tasks-count-empty-and-errors.html' }] },
});

// ---- Path info
const pathPayload = {
    code: 0,
    message: 'success',
    data: {
        path: {
            item: [
                { identifier: 'A1', text: '第一章', href: 'about:blank', item: [
                    { identifier: 'A2', text: '1-1 課程簡介', href: 'https://uu.nou.edu.tw/material/lesson-1.html?ticket=abc123&x=1', leaf: true },
                    { identifier: 'A3', text: '1-2 外部連結', href: 'https://example.com/elsewhere.html', leaf: true },
                ] },
                { identifier: 'B1', text: '講義', href: 'https://uu.nou.edu.tw/material/handout.pdf', leaf: true },
            ],
        },
    },
};
const MSI = 'Feature/Diagnostics/MaterialSourceInspectionTest.php';
fixture({
    domain: D,
    name: 'path-info-nested',
    ext: 'json',
    input: pathPayload,
    source: `${MSI}:39`,
    cls: 'AltUU\\Domains\\Course\\Actions\\GetCoursePathInfo',
    note: 'Upstream my-course-path-info payload. Expected values come from the diagnostics material-directory endpoint test (flattened node count/levels); golden is the course /api/courses/{cid}/path output.',
    cases: [{
        name: 'lists every directory node with the url the school sent',
        input: { cid: '9001' },
        partial: true,
        expected: { nodeCount: 4, apiCode: 0, 'nodes[0]': { identifier: 'A1', level: 0, href: 'about:blank', isInspectable: false }, 'nodes[1]': { level: 1, isInspectable: true } },
    }],
    golden: { kind: 'endpoint', path: '/api/courses/9001/path', fakes: [{ match: `${UU}/xmlapi/index.php?action=my-course-path-info*`, file: 'path-info-nested.json' }] },
});
fixture({
    domain: D,
    name: 'path-info-single-leaf',
    ext: 'json',
    input: { code: 0, message: 'success', data: { course_id: '10050559', base_url: UU, path: { text: '課程內容', item: [{ identifier: 'node1', href: `${UU}/learn/content1.html`, text: '第一課：導論', leaf: true, itemDisabled: false }] } } },
    source: 'Browser/Courses/MaterialTest.php:60',
    cls: 'AltUU\\Domains\\Course\\Actions\\GetCoursePathInfo',
    note: 'Payload from a browser test (no Pest assertion on the shape). Includes data.course_id/base_url/path.text so pathInfo fields are populated.',
    golden: { kind: 'endpoint', path: '/api/courses/10050559/path', fakes: [{ match: `${UU}/xmlapi/index.php?action=my-course-path-info*`, file: 'path-info-single-leaf.json' }] },
});

// ---- Learning times (synthetic upstream page; no legacy Pest coverage)
fixture({
    domain: D,
    name: 'learning-times-last10',
    ext: 'html',
    input: '<html><body><div class="data2"><table class="table subject">\n<tr><th>名稱</th><th>時數</th></tr>\n<tr><td>1-1 課程簡介</td><td>00:12:34</td></tr>\n<tr><td>講義</td><td>01:05:00</td></tr>\n<tr><td>第一章</td><td>00:00:09</td></tr>\n<tr><td>1-2 外部連結</td><td>--</td></tr>\n</table></div></body></html>',
    source: 'SYNTHETIC (no legacy test; shape derived from GetCourseLearningTimeItems parsing code)',
    cls: 'AltUU\\Domains\\Course\\Actions\\GetCourseLearningTimeItems',
    note: 'Use path-info-nested.json as the path payload. Leading zero hour group stripped (00:12:34 -> 12:34, 00:00:09 -> 00:09, 01:05:00 -> 1:05:00); non hh:mm:ss durations dropped. Golden produced by the real PHP action.',
    golden: { kind: 'endpoint', path: '/api/courses/9001/learning-times', fakes: [goCourse, { match: `${UU}/xmlapi/index.php?action=my-course-path-info*`, file: 'path-info-nested.json' }, { match: `${UU}/learn/last10.php*`, file: 'learning-times-last10.html' }] },
});

// ---- Node resources (synthetic)
fixture({
    domain: D,
    name: 'node-resources-list',
    ext: 'json',
    input: { code: 0, message: 'success', data: { list: [
        { download_path: '/base/10001/content/101279/files/handout.pdf', relative_path: 'files/handout.pdf', update_datetime: 1760000000, size: 123456, metadata: 'pdf', filename: 'handout.pdf', title: '講義', href: 'https://uu.nou.edu.tw/base/10001/content/101279/files/handout.pdf' },
        { filename: 'slides.zip', size: '2048', update_datetime: '1760000100' },
        'not-an-object',
    ] } },
    source: 'SYNTHETIC (no legacy test; shape derived from CourseMaterialResourceViewModel::fromPayload)',
    cls: 'AltUU\\Domains\\Course\\Actions\\GetNodeResources',
    note: 'Payload for upstream action course-node-resources. Non-array rows are skipped; missing fields default (size/update_datetime int-cast, metadata ""). Golden from real PHP action.',
    golden: { kind: 'endpoint', path: '/api/courses/9001/nodes/A2/resources', fakes: [{ match: `${UU}/xmlapi/index.php?action=course-node-resources*`, file: 'node-resources-list.json' }] },
});
