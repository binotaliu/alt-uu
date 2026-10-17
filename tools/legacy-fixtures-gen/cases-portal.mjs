import { fixture, hd } from './lib.mjs';

const D = 'school-portal';
const P = 'https://nouapp.nou.edu.tw';
const SP = 'Feature/SchoolPortal';
const A = 'AltUU\\Domains\\SchoolPortal\\Actions\\';
const course = (courseId, semester, name) => ({ courseId, semester, name });
const run = (name, c) => ({ name, course: c });

// ---- class session info (qryper)
{
    const f = `${SP}/GetCourseClassSessionInfoTest.php`;
    const m = course('9001', '115上', '假課程甲');
    const runs = [
        run('returns the matching course class session info, stripping the session-type suffix', m),
        run('returns null when no course matches', course('9002', '115上', '不存在的課程')),
        run('returns null when the term does not match', course('9001', '114下', '假課程甲')),
    ];
    fixture({
        domain: D, name: 'class-session-qryper', ext: 'html', input: hd(f, 16), source: `${f}:16`, cls: `${A}GetCourseClassSessionInfo`,
        note: 'Upstream GET /device/compliant/qryper/index. Action input: CourseItemViewModel(courseId, semester, name).',
        cases: [
            { name: runs[0].name, input: { course: m }, expected: { semesterLabel: '115學年上學期', classDates: '第1次 2026/09/22 第2次 2026/10/20', classType: '網路面授', classCode: 'ZZZ001', teacher: '假老師', classTime: '1900~2050' } },
            { name: runs[1].name, input: { course: runs[1].course }, expected: null },
            { name: runs[2].name, input: { course: runs[2].course }, expected: null },
        ].map((c, i) => (i === 0 ? { ...c, partial: false } : c)),
        golden: { kind: 'portal-action', action: 'GetCourseClassSessionInfo', fakes: [{ match: `${P}/device/compliant/qryper/index`, file: 'class-session-qryper.html' }], runs },
    });
}

// ---- exam info (qryexm)
{
    const f = `${SP}/GetCourseExamInfoTest.php`;
    const runs = [
        run('returns schedule and scope entries for a scheduled exam course', course('9001', '115上', '假課程甲')),
        run('returns a note instead of structured fields for a unified/non-scheduled exam', course('9002', '115上', '假課程乙')),
        run('returns null when no course matches', course('9003', '115上', '不存在的課程')),
        run('returns null when the term does not match', course('9001', '114下', '假課程甲')),
    ];
    fixture({
        domain: D, name: 'exam-info-qryexm', ext: 'html', input: hd(f, 18), source: `${f}:18`, cls: `${A}GetCourseExamInfo`,
        note: 'Upstream GET /device/compliant/qryexm/index.',
        cases: [
            { name: runs[0].name, input: { course: runs[0].course }, partial: true, expected: { semesterLabel: '115學年上學期', 'schedules.length': 1, 'schedules[0]': { category: '期中考(正考)', date: '2026年11月07日(星期六)', time: '1500~1610第5節', room: '41Z101', note: null }, 'scopes.length': 1, 'scopes[0]': { category: '期中考試範圍', scope: '第一章～第六章' } } },
            { name: runs[1].name, input: { course: runs[1].course }, partial: true, expected: { 'schedules.length': 1, 'schedules[0]': { date: null, note: '說明：統一命題非集中考試' }, scopes: [] } },
            { name: runs[2].name, input: { course: runs[2].course }, expected: null },
            { name: runs[3].name, input: { course: runs[3].course }, expected: null },
        ],
        golden: { kind: 'portal-action', action: 'GetCourseExamInfo', fakes: [{ match: `${P}/device/compliant/qryexm/index`, file: 'exam-info-qryexm.html' }], runs },
    });
}

// ---- semester grade (qryscore + qryscore2)
{
    const f = `${SP}/GetCourseSemesterGradeTest.php`;
    const runsCurrent = [
        run('returns the matching course grade', course('9001', '114下', '假課程甲')),
        run('matches a course name containing punctuation and a colon', course('9002', '114下', '假課程：附標點符號（其一～其二）')),
        run('returns null when no course matches', course('9003', '114下', '不存在的課程')),
        run('returns null when the term does not match', course('9001', '115暑', '假課程甲')),
    ];
    fixture({
        domain: D, name: 'semester-grade-qryscore', ext: 'html', input: hd(f, 15), source: `${f}:15`, cls: `${A}GetCourseSemesterGrade`,
        note: 'Upstream GET /device/compliant/qryscore/index with an EMPTY qryscore2 body (as fakeSchoolPortalGradesPage default).',
        cases: [
            { name: runsCurrent[0].name, input: { course: runsCurrent[0].course }, partial: true, expected: { semesterLabel: '114學年下學期', credits: '3', firstRegularScore: '缺', participationScore: '90', midtermScore: '70', finalScore: '無資料' } },
            { name: runsCurrent[1].name, input: { course: runsCurrent[1].course }, partial: true, expected: { credits: '2', midtermScore: '78' } },
            { name: runsCurrent[2].name, input: { course: runsCurrent[2].course }, expected: null },
            { name: runsCurrent[3].name, input: { course: runsCurrent[3].course }, expected: null },
        ],
        golden: { kind: 'portal-action', action: 'GetCourseSemesterGrade', fakes: [{ match: `${P}/device/compliant/qryscore/index`, file: 'semester-grade-qryscore.html' }, { match: `${P}/device/compliant/qryscore2/index`, body: '' }], runs: runsCurrent },
    });

    const runsBoth = [
        run('falls back to the historical grades page for a past semester not on the current-semester page', course('9004', '114下', '假課程乙')),
        run('prefers the current-semester page over the historical page when both have a match', course('9001', '114下', '假課程甲')),
        run('returns null when the course is absent from both the current and historical pages', course('9005', '114上', '不存在的課程')),
        run('splits a historical course line on the last colon when the course name itself contains one', course('9006', '114下', '假課程丙：附副標題（測試）')),
    ];
    fixture({
        domain: D, name: 'semester-grade-qryscore2', ext: 'html', input: hd(f, 25), source: `${f}:25`, cls: `${A}GetCourseSemesterGrade`,
        note: 'Historical grades page (GET /device/compliant/qryscore2/index); used together with semester-grade-qryscore.html as the qryscore page.',
        cases: [
            { name: runsBoth[0].name, input: { course: runsBoth[0].course }, partial: true, expected: { semesterLabel: '114下學期', credits: '5', semesterGrade: '85', midtermScore: null } },
            { name: runsBoth[1].name, input: { course: runsBoth[1].course }, partial: true, expected: { semesterLabel: '114學年下學期', firstRegularScore: '缺' } },
            { name: runsBoth[2].name, input: { course: runsBoth[2].course }, expected: null },
            { name: runsBoth[3].name, input: { course: runsBoth[3].course }, partial: true, expected: { courseName: '假課程丙：附副標題（測試）', semesterGrade: '73', credits: '2' } },
        ],
        golden: { kind: 'portal-action', action: 'GetCourseSemesterGrade', fakes: [{ match: `${P}/device/compliant/qryscore/index`, file: 'semester-grade-qryscore.html' }, { match: `${P}/device/compliant/qryscore2/index`, file: 'semester-grade-qryscore2.html' }], runs: runsBoth },
    });
}

// ---- homework notices (qryass)
{
    const f = `${SP}/GetSchoolPortalHomeworkNoticesTest.php`;
    const runsSingle = [
        run('matches homework notices for the correct course and term', course('9001', '115暑', '假課程乙')),
        run('returns no notices when the term does not match', course('9001', '114下', '假課程乙')),
        run('returns no notices when the course name does not match', course('9001', '115暑', '完全不相關的課程')),
    ];
    fixture({
        domain: D, name: 'homework-notices-qryass', ext: 'html', input: hd(f, 14), source: `${f}:14`, cls: `${A}GetSchoolPortalHomeworkNotices`,
        note: 'Upstream GET /device/compliant/qryass/index. Action returns a collection; expected is the items() array.',
        cases: [
            { name: runsSingle[0].name, input: { course: runsSingle[0].course }, partial: true, expected: { count: 2, '0': { title: '第1次作業', submissionMethod: '依面授教師指定方式繳交', dueDate: '繳交日期：2026年08月16日', downloadUrl: `${P}/device/compliant/qryass/download?type=homework&filename=1153_900001_1&extension=pdf&_b=%5B%5D` }, '1.downloadUrl': { contains: 'filename=1153_900001_2' } } },
            { name: runsSingle[1].name, input: { course: runsSingle[1].course }, expected: [] },
            { name: runsSingle[2].name, input: { course: runsSingle[2].course }, expected: [] },
        ],
        golden: { kind: 'portal-action', action: 'GetSchoolPortalHomeworkNotices', fakes: [{ match: `${P}/device/compliant/qryass/index`, file: 'homework-notices-qryass.html' }], runs: runsSingle },
    });

    const runsMulti = [
        run('first course', course('9001', '115上', '假課程甲')),
        run('second course', course('9001', '115上', '假課程乙')),
        run('third course', course('9001', '115上', '假課程丙')),
        run('later assignments: first course (id 1)', course('1', '115上', '假課程甲')),
        run('later assignments: other course (id 2)', course('2', '115上', '假課程乙')),
    ];
    fixture({
        domain: D, name: 'homework-notices-qryass-multi-course', ext: 'html', input: hd(f, 20), source: `${f}:20`, cls: `${A}GetSchoolPortalHomeworkNotices`,
        cases: [
            { name: 'returns a notice for every course listed under the same assignment: first course', input: { course: runsMulti[0].course }, partial: true, expected: { '0': { title: '第1次作業', downloadUrl: { contains: 'filename=1151_000001_1&' }, dueDate: '繳交日期：2026年10月01日', submissionMethod: '依面授教師指定方式繳交' } } },
            { name: 'returns a notice for every course listed under the same assignment: second course', input: { course: runsMulti[1].course }, partial: true, expected: { '0': { title: '第1次作業', downloadUrl: { contains: 'filename=1151_000002_1&' }, dueDate: '繳交日期：依面授老師規定', submissionMethod: '依面授教師指定方式繳交' } } },
            { name: 'returns a notice for every course listed under the same assignment: third course', input: { course: runsMulti[2].course }, partial: true, expected: { '0': { title: '第1次作業', downloadUrl: { contains: 'filename=1151_000003_1&' }, dueDate: '繳交日期：依面授老師規定', submissionMethod: '依面授教師指定方式繳交' } } },
            { name: 'keeps notices from later assignments alongside multi-course ones (course 假課程甲, id 1)', input: { course: runsMulti[3].course }, partial: true, expected: { titles: ['第1次作業', '第2次作業'], '1.downloadUrl': { contains: 'filename=1151_000001_ZZZ001_2' } } },
            { name: 'keeps notices from later assignments alongside multi-course ones (course 假課程乙, id 2)', input: { course: runsMulti[4].course }, partial: true, expected: { titles: ['第1次作業'] } },
        ],
        golden: { kind: 'portal-action', action: 'GetSchoolPortalHomeworkNotices', fakes: [{ match: `${P}/device/compliant/qryass/index`, file: 'homework-notices-qryass-multi-course.html' }], runs: runsMulti },
    });
}

// ---- all grades (/api/grades)
{
    const f = 'Feature/Course/AllCourseGradesApiTest.php';
    fixture({
        domain: D, name: 'all-grades', cls: 'AltUU\\Domains\\SchoolPortal\\Actions\\GetAllCourseGrades (via GET /api/grades)', source: `${f}:34`,
        inputs: [
            { suffix: 'qryscore', ext: 'html', content: hd(f, 37) },
            { suffix: 'qryscore2', ext: 'html', content: hd(f, 42) },
        ],
        note: 'Upstream qryscore (.qryscore.html) and qryscore2 (.qryscore2.html) pages.',
        cases: [
            { name: 'returns every grade the portal has, most recent semester first, deduping the current semester', partial: true, expected: { gradesCount: 2, 'grades[0]': { courseName: '假課程乙', semesterLabel: '115暑期' }, 'grades[1]': { courseName: '假課程甲', semesterLabel: '114學年下學期', midtermScore: '70' } } },
            { name: 'returns an empty list when the portal has no grades', input: { qryscoreStatus: 500, qryscore2Status: 500, body: '' }, expected: { grades: [] } },
        ],
        golden: { kind: 'endpoint', portal: true, path: '/api/grades', fakes: [{ match: `${P}/device/compliant/qryscore/index`, file: 'all-grades.qryscore.html' }, { match: `${P}/device/compliant/qryscore2/index`, file: 'all-grades.qryscore2.html' }] },
    });
}

// ---- exam agenda (/api/exam-agenda)
{
    const f = 'Feature/Course/ExamAgendaApiTest.php';
    fixture({
        domain: D, name: 'exam-agenda', ext: 'html', input: hd(f, 37), source: `${f}:34`, cls: 'AltUU\\Domains\\SchoolPortal\\Actions\\GetExamAgenda (via GET /api/exam-agenda)',
        note: 'Upstream qryexm page. 假課程丙 正考 has no time (note only) and 假課程甲 補考 is not 正考, so both are excluded.',
        cases: [
            { name: 'returns only 正考 exams with a scheduled time, ordered by time ascending', partial: true, expected: { itemsCount: 2, 'items[0]': { courseName: '假課程乙', time: '0900~1040第2節', room: '41Z102' }, 'items[1]': { courseName: '假課程甲', time: '1500~1610第5節' } } },
            { name: 'returns an empty list when the portal has no exam info', input: { qryexmStatus: 500, body: '' }, expected: { items: [] } },
        ],
        golden: { kind: 'endpoint', portal: true, path: '/api/exam-agenda', fakes: [{ match: `${P}/device/compliant/qryexm/index`, file: 'exam-agenda.html' }] },
    });
}

// ---- course grade (/api/courses/{cid}/grades)
{
    const f = 'Feature/Course/CourseGradeApiTest.php';
    const lc = { code: 0, data: { list: [{ course_id: '9001', title: '(114下)假課程甲' }] } };
    fixture({
        domain: D, name: 'course-grade', ext: 'html', input: hd(f, 48), source: `${f}:34`, cls: 'AltUU\\Domains\\SchoolPortal\\Actions\\GetCourseSemesterGrade (via GET /api/courses/{cid}/grades)',
        note: 'Upstream qryscore page; my-course-list payload: course 9001 "(114下)假課程甲".',
        cases: [
            { name: 'returns the matching school portal grade for a course', input: { cid: '9001', courseListPayload: lc }, partial: true, expected: { 'grade.courseName': '假課程甲', 'grade.semesterLabel': '114學年下學期', 'grade.credits': '3', 'grade.midtermScore': '70', 'grade.finalScore': '無資料' } },
            { name: 'returns a null grade when the course is not found', input: { cid: 'does-not-exist', courseListPayload: { code: 0, data: { list: [] } } }, partial: true, expected: { grade: null } },
        ],
        golden: { kind: 'endpoint', portal: true, path: '/api/courses/9001/grades', fakes: [{ match: 'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*', json: lc }, { match: `${P}/device/compliant/qryscore/index`, file: 'course-grade.html' }] },
    });
}

// ---- school portal info (/api/courses/{cid}/school-portal-info)
{
    const f = 'Feature/Course/CourseSchoolPortalInfoApiTest.php';
    const lc = { code: 0, data: { list: [{ course_id: '9001', title: '(115上)假課程甲' }] } };
    fixture({
        domain: D, name: 'school-portal-info', cls: 'AltUU\\Domains\\SchoolPortal\\Actions\\GetCourseClassSessionInfo + GetCourseExamInfo (via GET /api/courses/{cid}/school-portal-info)', source: `${f}:34`,
        inputs: [
            { suffix: 'qryper', ext: 'html', content: hd(f, 48) },
            { suffix: 'qryexm', ext: 'html', content: hd(f, 53) },
        ],
        note: 'Upstream qryper (.qryper.html) and qryexm (.qryexm.html); my-course-list payload: course 9001 "(115上)假課程甲".',
        cases: [
            { name: 'returns class session and exam info for a matching course', input: { cid: '9001', courseListPayload: lc }, partial: true, expected: { 'classSessionInfo.teacher': '假老師', 'classSessionInfo.classTime': '1900~2050', 'examInfo.schedules[0].category': '期中考(正考)', 'examInfo.schedules[0].date': '2026年11月07日(星期六)' } },
            { name: 'returns nulls when the course is not found', input: { cid: 'does-not-exist', courseListPayload: { code: 0, data: { list: [] } } }, expected: { classSessionInfo: null, examInfo: null } },
        ],
        golden: { kind: 'endpoint', portal: true, path: '/api/courses/9001/school-portal-info', fakes: [{ match: 'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*', json: lc }, { match: `${P}/device/compliant/qryper/index`, file: 'school-portal-info.qryper.html' }, { match: `${P}/device/compliant/qryexm/index`, file: 'school-portal-info.qryexm.html' }] },
    });
}
