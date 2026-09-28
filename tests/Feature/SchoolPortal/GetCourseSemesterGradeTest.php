<?php

use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use AltUU\Domains\SchoolPortal\Actions\GetCourseSemesterGrade;
use App\Services\SchoolPortalSessionStore;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;

// Fixture modeled on the school portal's qryscore page structure
// (GET /device/compliant/qryscore/index), including the leading XML
// declaration the portal actually serves and a course name containing
// punctuation ("：", full-width parens, "～") to exercise the
// name-normalizer's edge cases. Course names are placeholders, not real data.
const QRYSCORE_HTML = <<<'HTML'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML Basic 1.1//EN" "http://www.w3.org/TR/xhtml-basic/xhtml-basic11.dtd"><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en"><body class="QryscoreModule kgo-has-navbar"><div class="header-bar d-flex align-items-center"><a href="/device/compliant/schoolsystem/index" class="back-btn" title="返回"><i class="fas fa-chevron-left"></i></a><p class="ms-2 mb-0">查詢當學期成績</p></div><div id="container"><a name="content_top" id="content_top"></a><div class="year-box"><div class="year">114學年下學期</div></div><div class="accordion" id="accordion-courses"><div class="accordion-item"><h2 class="accordion-header" id="heading-1"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-1" aria-expanded="false" aria-controls="collapse-1">假課程甲</button></h2><div id="collapse-1" class="accordion-collapse collapse" aria-labelledby="heading-1"><div class="accordion-body p-0"><div class="detail">學分數：<span class="">3</span></div><div class="detail">第一次平時成績：<span class="text-danger">缺</span></div><div class="detail">第二次平時成績：<span class="text-danger">缺</span></div><div class="detail">學習參與成績：<span class="">90</span></div><div class="detail">平時成績平均：<span class="text-danger">30</span></div><div class="detail">期中成績：<span class="">70</span></div><div class="detail">期末成績：<span class="">無資料</span></div><div class="detail">學期成績：<span class="">無資料</span></div></div></div></div><div class="accordion-item"><h2 class="accordion-header" id="heading-4"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-4" aria-expanded="false" aria-controls="collapse-4">假課程：附標點符號（其一～其二）</button></h2><div id="collapse-4" class="accordion-collapse collapse" aria-labelledby="heading-4"><div class="accordion-body p-0"><div class="detail">學分數：<span class="">2</span></div><div class="detail">第一次平時成績：<span class="text-danger">缺</span></div><div class="detail">第二次平時成績：<span class="text-danger">缺</span></div><div class="detail">學習參與成績：<span class="">100</span></div><div class="detail">平時成績平均：<span class="text-danger">33</span></div><div class="detail">期中成績：<span class="">78</span></div><div class="detail">期末成績：<span class="">無資料</span></div><div class="detail">學期成績：<span class="">無資料</span></div></div></div></div></div><div id="footerlinks"><a href="#top" title="回最上方">回最上方</a> | <a href="/device/compliant/home/" title="國立空中大學 主頁">國立空中大學 主頁</a></div></div></body></html>
HTML;

// Fixture modeled on the school portal's qryscore2 (historical grades) page
// structure (GET /device/compliant/qryscore2/index): one accordion per
// semester, titled e.g. "114下學期：總計修讀 X 學分" (no "學年" prefix, unlike
// qryscore), with course lines reading "課程名稱：分數 (X學分)" — a coarser
// field set than qryscore's per-component breakdown. Course names are
// placeholders, not real data.
const QRYSCORE2_HTML = <<<'HTML'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML Basic 1.1//EN" "http://www.w3.org/TR/xhtml-basic/xhtml-basic11.dtd"><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en"><body class="qryscore2Module kgo-has-navbar"><div class="header-bar d-flex align-items-center"><a href="/device/compliant/schoolsystem/index" class="back-btn" title="返回"><i class="fas fa-chevron-left"></i></a><p class="ms-2 mb-0">查詢歷年成績</p></div><div id="container"><a name="content_top" id="content_top"></a><div class="accordion" id="accordion-courses"><div class="accordion-item"><h2 class="accordion-header" id="heading-1"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-1" aria-expanded="false" aria-controls="collapse-1">115暑期：總計修讀 2 學分</button></h2><div id="collapse-1" class="accordion-collapse collapse" aria-labelledby="heading-1"><div class="accordion-body p-0"><div class="detail">假課程甲：<span class="">63</span> (2學分)</div></div></div></div><div class="accordion-item"><h2 class="accordion-header" id="heading-2"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-2" aria-expanded="false" aria-controls="collapse-2">114下學期：總計修讀 7 學分</button></h2><div id="collapse-2" class="accordion-collapse collapse" aria-labelledby="heading-2"><div class="accordion-body p-0"><div class="detail">假課程乙：<span class="">85</span> (5學分)</div><div class="detail">假課程丙：附副標題（測試）：<span class="">73</span> (2學分)</div></div></div></div></div><div id="footerlinks"><a href="#top" title="回最上方">回最上方</a> | <a href="/device/compliant/home/" title="國立空中大學 主頁">國立空中大學 主頁</a></div></div></body></html>
HTML;

function fakeSchoolPortalGradesPage(string $html, string $historicalHtml = ''): void
{
    $sessionStore = MockeryManager::mock(SchoolPortalSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn([
        'base_url' => 'https://nouapp.nou.edu.tw',
        'ua' => 'test-agent',
        'cookies' => ['session' => 'abc'],
    ]);
    $sessionStore->shouldReceive('put');
    app()->instance(SchoolPortalSessionStore::class, $sessionStore);

    Http::fake([
        'https://nouapp.nou.edu.tw/device/compliant/qryscore/index' => Http::response($html),
        'https://nouapp.nou.edu.tw/device/compliant/qryscore2/index' => Http::response($historicalHtml),
    ]);
}

it('returns the matching course grade', function () {
    fakeSchoolPortalGradesPage(QRYSCORE_HTML);

    $action = app(GetCourseSemesterGrade::class);
    $course = new CourseItemViewModel(
        courseId: '9001',
        semester: '114下',
        name: '假課程甲',
    );

    $grade = $action(Request::create('/'), $course);

    expect($grade)->not->toBeNull();
    expect($grade->semesterLabel)->toBe('114學年下學期');
    expect($grade->credits)->toBe('3');
    expect($grade->firstRegularScore)->toBe('缺');
    expect($grade->participationScore)->toBe('90');
    expect($grade->midtermScore)->toBe('70');
    expect($grade->finalScore)->toBe('無資料');
});

it('matches a course name containing punctuation and a colon', function () {
    fakeSchoolPortalGradesPage(QRYSCORE_HTML);

    $action = app(GetCourseSemesterGrade::class);
    $course = new CourseItemViewModel(
        courseId: '9002',
        semester: '114下',
        name: '假課程：附標點符號（其一～其二）',
    );

    $grade = $action(Request::create('/'), $course);

    expect($grade)->not->toBeNull();
    expect($grade->credits)->toBe('2');
    expect($grade->midtermScore)->toBe('78');
});

it('returns null when no course matches', function () {
    fakeSchoolPortalGradesPage(QRYSCORE_HTML);

    $action = app(GetCourseSemesterGrade::class);
    $course = new CourseItemViewModel(
        courseId: '9003',
        semester: '114下',
        name: '不存在的課程',
    );

    expect($action(Request::create('/'), $course))->toBeNull();
});

it('returns null when the term does not match', function () {
    fakeSchoolPortalGradesPage(QRYSCORE_HTML);

    $action = app(GetCourseSemesterGrade::class);
    $course = new CourseItemViewModel(
        courseId: '9001',
        semester: '115暑',
        name: '假課程甲',
    );

    expect($action(Request::create('/'), $course))->toBeNull();
});

it('falls back to the historical grades page for a past semester not on the current-semester page', function () {
    fakeSchoolPortalGradesPage(QRYSCORE_HTML, QRYSCORE2_HTML);

    $action = app(GetCourseSemesterGrade::class);
    $course = new CourseItemViewModel(
        courseId: '9004',
        semester: '114下',
        name: '假課程乙',
    );

    $grade = $action(Request::create('/'), $course);

    expect($grade)->not->toBeNull();
    expect($grade->semesterLabel)->toBe('114下學期');
    expect($grade->credits)->toBe('5');
    expect($grade->semesterGrade)->toBe('85');
    expect($grade->midtermScore)->toBeNull();
});

it('prefers the current-semester page over the historical page when both have a match', function () {
    fakeSchoolPortalGradesPage(QRYSCORE_HTML, QRYSCORE2_HTML);

    $action = app(GetCourseSemesterGrade::class);
    $course = new CourseItemViewModel(
        courseId: '9001',
        semester: '114下',
        name: '假課程甲',
    );

    $grade = $action(Request::create('/'), $course);

    expect($grade)->not->toBeNull();
    expect($grade->semesterLabel)->toBe('114學年下學期');
    expect($grade->firstRegularScore)->toBe('缺');
});

it('returns null when the course is absent from both the current and historical pages', function () {
    fakeSchoolPortalGradesPage(QRYSCORE_HTML, QRYSCORE2_HTML);

    $action = app(GetCourseSemesterGrade::class);
    $course = new CourseItemViewModel(
        courseId: '9005',
        semester: '114上',
        name: '不存在的課程',
    );

    expect($action(Request::create('/'), $course))->toBeNull();
});

it('splits a historical course line on the last colon when the course name itself contains one', function () {
    fakeSchoolPortalGradesPage(QRYSCORE_HTML, QRYSCORE2_HTML);

    $action = app(GetCourseSemesterGrade::class);
    $course = new CourseItemViewModel(
        courseId: '9006',
        semester: '114下',
        name: '假課程丙：附副標題（測試）',
    );

    $grade = $action(Request::create('/'), $course);

    expect($grade)->not->toBeNull();
    expect($grade->courseName)->toBe('假課程丙：附副標題（測試）');
    expect($grade->semesterGrade)->toBe('73');
    expect($grade->credits)->toBe('2');
});
