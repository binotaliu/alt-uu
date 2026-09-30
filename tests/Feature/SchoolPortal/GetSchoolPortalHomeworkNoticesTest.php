<?php

use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use AltUU\Domains\SchoolPortal\Actions\GetSchoolPortalHomeworkNotices;
use App\Services\SchoolPortalSessionStore;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;

// Fixture modeled on the school portal's qryass page structure
// (GET /device/compliant/qryass/index), including the leading XML
// declaration the portal actually serves. Course and class names are
// placeholders, not real data.
const QRYASS_HTML = <<<'HTML'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML Basic 1.1//EN" "http://www.w3.org/TR/xhtml-basic/xhtml-basic11.dtd"><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en"><body class="QryassModule kgo-has-navbar"><div class="header-bar d-flex align-items-center"><a href="/device/compliant/schoolsystem/index" class="back-btn" title="返回"><i class="fas fa-chevron-left"></i></a><p class="ms-2 mb-0">作業考試題目</p></div><div id="container"><a name="content_top" id="content_top"></a><div class="year-box"><div class="year">115學年暑期</div></div><div class="accordion" id="accordion-homework"><div class="accordion-item"><h2 class="accordion-header" id="heading-homework-1"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-homework-1" aria-expanded="false" aria-controls="collapse-homework-1">第1次作業</button></h2><div id="collapse-homework-1" class="accordion-collapse collapse" aria-labelledby="heading-homework-1"><div class="accordion-body p-0"><div class="detail-title">假課程乙</div><div class="detail">作業班級：000001</div><div class="detail">教師姓名：</div><div class="detail">繳交日期：2026年08月16日</div><div class="detail">繳交方式：依面授教師指定方式繳交</div><div class="detail-url"><a class="d-flex justify-content-between align-items-center" href="/device/compliant/qryass/download?type=homework&filename=1153_900001_1&extension=pdf&_b=%5B%5D"><span>作業題目：1153_900001_1.pdf</span><i class="fa-solid fa-download"></i></a></div></div></div></div><div class="accordion-item"><h2 class="accordion-header" id="heading-homework-2"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-homework-2" aria-expanded="false" aria-controls="collapse-homework-2">第2次作業</button></h2><div id="collapse-homework-2" class="accordion-collapse collapse" aria-labelledby="heading-homework-2"><div class="accordion-body p-0"><div class="detail-title">假課程乙</div><div class="detail">作業班級：000001</div><div class="detail">教師姓名：</div><div class="detail">繳交日期：2026年08月16日</div><div class="detail">繳交方式：依面授教師指定方式繳交</div><div class="detail-url"><a class="d-flex justify-content-between align-items-center" href="/device/compliant/qryass/download?type=homework&filename=1153_900001_2&extension=pdf&_b=%5B%5D"><span>作業題目：1153_900001_2.pdf</span><i class="fa-solid fa-download"></i></a></div></div></div></div></div><div id="footerlinks"><a href="#top" title="回最上方">回最上方</a> | <a href="/device/compliant/home/" title="國立空中大學 主頁">國立空中大學 主頁</a></div></div></body></html>
HTML;

// Fixture where one assignment item lists several courses, as the portal does:
// each course is a detail-title followed by its own detail rows and download link.
const QRYASS_MULTI_COURSE_HTML = <<<'HTML'
<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><div id="container"><div class="year-box"><div class="year">115學年上學期</div></div><div class="accordion" id="accordion-homework"><div class="accordion-item"><h2 class="accordion-header" id="heading-homework-1"><button class="accordion-button collapsed" type="button">第1次作業</button></h2><div id="collapse-homework-1" class="accordion-collapse collapse"><div class="accordion-body p-0"><div class="detail-title">假課程甲</div><div class="detail">作業班級：ZZZ001</div><div class="detail">教師姓名：</div><div class="detail">繳交日期：2026年10月01日</div><div class="detail">繳交方式：依面授教師指定方式繳交</div><div class="detail-url"><a class="d-flex" href="/device/compliant/qryass/download?type=homework&filename=1151_000001_1&extension=pdf&_b=%5B%5D"><span>作業題目：1151_000001_1.pdf</span></a></div><div class="detail-title">假課程乙</div><div class="detail">作業班級：ZZZ101</div><div class="detail">教師姓名：</div><div class="detail">繳交日期：依面授老師規定</div><div class="detail">繳交方式：依面授教師指定方式繳交</div><div class="detail-url"><a class="d-flex" href="/device/compliant/qryass/download?type=homework&filename=1151_000002_1&extension=pdf&_b=%5B%5D"><span>作業題目：1151_000002_1.pdf</span></a></div><div class="detail-title">假課程丙</div><div class="detail">作業班級：ZZZ001</div><div class="detail">教師姓名：</div><div class="detail">繳交日期：依面授老師規定</div><div class="detail">繳交方式：依面授教師指定方式繳交</div><div class="detail-url"><a class="d-flex" href="/device/compliant/qryass/download?type=homework&filename=1151_000003_1&extension=pdf&_b=%5B%5D"><span>作業題目：1151_000003_1.pdf</span></a></div></div></div></div><div class="accordion-item"><h2 class="accordion-header" id="heading-homework-2"><button class="accordion-button collapsed" type="button">第2次作業</button></h2><div id="collapse-homework-2" class="accordion-collapse collapse"><div class="accordion-body p-0"><div class="detail-title">假課程甲</div><div class="detail">作業班級：ZZZ001</div><div class="detail">教師姓名：</div><div class="detail">繳交日期：依面授老師規定</div><div class="detail">繳交方式：依面授教師指定方式繳交</div><div class="detail-url"><a class="d-flex" href="/device/compliant/qryass/download?type=homework&filename=1151_000001_ZZZ001_2&extension=pdf&_b=%5B%5D"><span>作業題目：1151_000001_ZZZ001_2.pdf</span></a></div></div></div></div></div></div></body></html>
HTML;

function fakeSchoolPortalHomeworkPage(string $html): void
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
        'https://nouapp.nou.edu.tw/device/compliant/qryass/index' => Http::response($html),
    ]);
}

it('matches homework notices for the correct course and term', function () {
    fakeSchoolPortalHomeworkPage(QRYASS_HTML);

    $action = app(GetSchoolPortalHomeworkNotices::class);
    $course = new CourseItemViewModel(
        courseId: '9001',
        semester: '115暑',
        name: '假課程乙',
    );

    $items = $action($course)->items();

    expect($items)->toHaveCount(2);
    expect($items[0]->title)->toBe('第1次作業');
    expect($items[0]->submissionMethod)->toBe('依面授教師指定方式繳交');
    expect($items[0]->dueDate)->toBe('繳交日期：2026年08月16日');
    expect($items[0]->downloadUrl)->toBe(
        'https://nouapp.nou.edu.tw/device/compliant/qryass/download?type=homework&filename=1153_900001_1&extension=pdf&_b=%5B%5D',
    );
    expect($items[1]->downloadUrl)->toContain('filename=1153_900001_2');
});

it('returns no notices when the term does not match', function () {
    fakeSchoolPortalHomeworkPage(QRYASS_HTML);

    $action = app(GetSchoolPortalHomeworkNotices::class);
    $course = new CourseItemViewModel(
        courseId: '9001',
        semester: '114下',
        name: '假課程乙',
    );

    expect($action($course)->items())->toBeEmpty();
});

it('returns no notices when the course name does not match', function () {
    fakeSchoolPortalHomeworkPage(QRYASS_HTML);

    $action = app(GetSchoolPortalHomeworkNotices::class);
    $course = new CourseItemViewModel(
        courseId: '9001',
        semester: '115暑',
        name: '完全不相關的課程',
    );

    expect($action($course)->items())->toBeEmpty();
});

it('returns a notice for every course listed under the same assignment', function (string $name, string $filename, ?string $dueDate) {
    fakeSchoolPortalHomeworkPage(QRYASS_MULTI_COURSE_HTML);

    $action = app(GetSchoolPortalHomeworkNotices::class);
    $course = new CourseItemViewModel(
        courseId: '9001',
        semester: '115上',
        name: $name,
    );

    $items = $action($course)->items();

    expect($items[0]->title)->toBe('第1次作業');
    expect($items[0]->downloadUrl)->toContain("filename={$filename}&");
    expect($items[0]->dueDate)->toBe($dueDate);
    expect($items[0]->submissionMethod)->toBe('依面授教師指定方式繳交');
})->with([
    'first course' => ['假課程甲', '1151_000001_1', '繳交日期：2026年10月01日'],
    'second course' => ['假課程乙', '1151_000002_1', '繳交日期：依面授老師規定'],
    'third course' => ['假課程丙', '1151_000003_1', '繳交日期：依面授老師規定'],
]);

it('keeps notices from later assignments alongside multi-course ones', function () {
    fakeSchoolPortalHomeworkPage(QRYASS_MULTI_COURSE_HTML);

    $action = app(GetSchoolPortalHomeworkNotices::class);

    $first = $action(new CourseItemViewModel(courseId: '1', semester: '115上', name: '假課程甲'))->items();
    $other = $action(new CourseItemViewModel(courseId: '2', semester: '115上', name: '假課程乙'))->items();

    expect(collect($first)->pluck('title')->all())->toBe(['第1次作業', '第2次作業']);
    expect($first[1]->downloadUrl)->toContain('filename=1151_000001_ZZZ001_2');
    expect(collect($other)->pluck('title')->all())->toBe(['第1次作業']);
});
