<?php

use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use AltUU\Domains\SchoolPortal\Actions\GetCourseExamInfo;
use App\Services\SchoolPortalSessionStore;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;

// Fixture modeled on the school portal's qryexm page structure
// (GET /device/compliant/qryexm/index): a "考試時間" section
// (#accordion-courses-exmtime) whose leaf categories (e.g. "期中考(正考)")
// list courses as "◉ 課程名稱" title markers followed by "detail" rows
// (some structured as 日期/時間/教室代號, others a single free-form "說明"
// for unified/non-scheduled exams), and a "考試命題範圍" section
// (#accordion-courses-range) with the same title/detail shape but
// free-form scope text. Course names are placeholders, not real data.
const QRYEXM_HTML = <<<'HTML'
<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body class="QryexmModule"><div id="container"><div class="year-box"><div class="year">115學年上學期</div></div><div class="accordion" id="accordion-courses-exmtime"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">考試時間</button></h2><div class="accordion-body p-0"><div class="accordion" id="accordion-courses"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">期中考(正考)</button></h2><div class="accordion-body p-0"><div class="title">◉ 假課程甲</div><div class="detail"><div>日期：2026年11月07日(星期六)</div></div><div class="detail"><div>時間：1500~1610第5節</div></div><div class="detail"><div>教室代號：41Z101</div></div><div class="title">◉ 假課程乙</div><div class="detail"><div>說明：統一命題非集中考試</div></div></div></div></div></div></div></div><div class="accordion" id="accordion-courses-range"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">考試命題範圍</button></h2><div class="accordion-body p-0"><div class="accordion" id="accordion-courses"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">期中考試範圍</button></h2><div class="accordion-body p-0"><div class="title">◉ 假課程甲</div><div class="detail"><div>第一章～第六章</div></div></div></div></div></div></div></div></div></body></html>
HTML;

function fakeSchoolPortalExamInfoPage(string $html): void
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
        'https://nouapp.nou.edu.tw/device/compliant/qryexm/index' => Http::response($html),
    ]);
}

it('returns schedule and scope entries for a scheduled exam course', function () {
    fakeSchoolPortalExamInfoPage(QRYEXM_HTML);

    $action = app(GetCourseExamInfo::class);
    $course = new CourseItemViewModel(
        courseId: '9001',
        semester: '115上',
        name: '假課程甲',
    );

    $info = $action($course);

    expect($info)->not->toBeNull();
    expect($info->semesterLabel)->toBe('115學年上學期');
    expect($info->schedules)->toHaveCount(1);
    expect($info->schedules[0]->category)->toBe('期中考(正考)');
    expect($info->schedules[0]->date)->toBe('2026年11月07日(星期六)');
    expect($info->schedules[0]->time)->toBe('1500~1610第5節');
    expect($info->schedules[0]->room)->toBe('41Z101');
    expect($info->schedules[0]->note)->toBeNull();
    expect($info->scopes)->toHaveCount(1);
    expect($info->scopes[0]->category)->toBe('期中考試範圍');
    expect($info->scopes[0]->scope)->toBe('第一章～第六章');
});

it('returns a note instead of structured fields for a unified/non-scheduled exam', function () {
    fakeSchoolPortalExamInfoPage(QRYEXM_HTML);

    $action = app(GetCourseExamInfo::class);
    $course = new CourseItemViewModel(
        courseId: '9002',
        semester: '115上',
        name: '假課程乙',
    );

    $info = $action($course);

    expect($info)->not->toBeNull();
    expect($info->schedules)->toHaveCount(1);
    expect($info->schedules[0]->date)->toBeNull();
    expect($info->schedules[0]->note)->toBe('說明：統一命題非集中考試');
    expect($info->scopes)->toBe([]);
});

it('returns null when no course matches', function () {
    fakeSchoolPortalExamInfoPage(QRYEXM_HTML);

    $action = app(GetCourseExamInfo::class);
    $course = new CourseItemViewModel(
        courseId: '9003',
        semester: '115上',
        name: '不存在的課程',
    );

    expect($action($course))->toBeNull();
});

it('returns null when the term does not match', function () {
    fakeSchoolPortalExamInfoPage(QRYEXM_HTML);

    $action = app(GetCourseExamInfo::class);
    $course = new CourseItemViewModel(
        courseId: '9001',
        semester: '114下',
        name: '假課程甲',
    );

    expect($action($course))->toBeNull();
});
