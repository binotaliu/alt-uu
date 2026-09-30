<?php

use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use AltUU\Domains\SchoolPortal\Actions\GetCourseClassSessionInfo;
use App\Services\SchoolPortalSessionStore;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;

// Fixture modeled on the school portal's qryper page structure
// (GET /device/compliant/qryper/index). The portal appends a session-type
// suffix like "(網路面授)" to the course title on this page only — it isn't
// part of the course's actual name — which the parser must strip before
// matching against Hongu's course list. Course names are placeholders,
// not real data.
const QRYPER_HTML = <<<'HTML'
<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body class="QryperModule"><div id="container"><div class="year-box"><div class="year">115學年上學期</div></div><div class="tip">※若老師調課，請依調課時間為準</div><div class="accordion" id="accordion-courses"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">假課程甲(網路面授)</button></h2><div class="accordion-body p-0"><div class="detail time">授課日期：<br>第1次 2026/09/22 <br>第2次 2026/10/20 <br></div><div class="detail">班級類型：網路面授</div><div class="detail">授課班級代碼：ZZZ001</div><div class="detail">授課教師：假老師</div><div class="detail">上課時間：1900~2050</div></div></div></div></div></body></html>
HTML;

function fakeSchoolPortalClassSessionPage(string $html): void
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
        'https://nouapp.nou.edu.tw/device/compliant/qryper/index' => Http::response($html),
    ]);
}

it('returns the matching course class session info, stripping the session-type suffix', function () {
    fakeSchoolPortalClassSessionPage(QRYPER_HTML);

    $action = app(GetCourseClassSessionInfo::class);
    $course = new CourseItemViewModel(
        courseId: '9001',
        semester: '115上',
        name: '假課程甲',
    );

    $info = $action($course);

    expect($info)->not->toBeNull();
    expect($info->semesterLabel)->toBe('115學年上學期');
    expect($info->classDates)->toBe('第1次 2026/09/22 第2次 2026/10/20');
    expect($info->classType)->toBe('網路面授');
    expect($info->classCode)->toBe('ZZZ001');
    expect($info->teacher)->toBe('假老師');
    expect($info->classTime)->toBe('1900~2050');
});

it('returns null when no course matches', function () {
    fakeSchoolPortalClassSessionPage(QRYPER_HTML);

    $action = app(GetCourseClassSessionInfo::class);
    $course = new CourseItemViewModel(
        courseId: '9002',
        semester: '115上',
        name: '不存在的課程',
    );

    expect($action($course))->toBeNull();
});

it('returns null when the term does not match', function () {
    fakeSchoolPortalClassSessionPage(QRYPER_HTML);

    $action = app(GetCourseClassSessionInfo::class);
    $course = new CourseItemViewModel(
        courseId: '9001',
        semester: '114下',
        name: '假課程甲',
    );

    expect($action($course))->toBeNull();
});
