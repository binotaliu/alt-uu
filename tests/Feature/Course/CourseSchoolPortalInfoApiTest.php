<?php

use App\Services\SchoolPortalSessionStore;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;

use function Pest\Laravel\get;

function fakeCourseSchoolPortalInfoSessions(): void
{
    $honguSession = MockeryManager::mock(UUSessionStore::class);
    $honguSession->shouldReceive('get')->andReturn([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試使用者', 'username' => 'u1001'],
    ]);
    $honguSession->shouldReceive('put');
    app()->instance(UUSessionStore::class, $honguSession);

    $schoolPortalSession = MockeryManager::mock(SchoolPortalSessionStore::class);
    $schoolPortalSession->shouldReceive('get')->andReturn([
        'base_url' => 'https://nouapp.nou.edu.tw',
        'ua' => 'test-agent',
        'cookies' => ['session' => 'abc'],
    ]);
    $schoolPortalSession->shouldReceive('put');
    app()->instance(SchoolPortalSessionStore::class, $schoolPortalSession);
}

it('returns class session and exam info for a matching course', function () {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'data' => [
                'list' => [
                    [
                        'course_id' => '9001',
                        'title' => '(115上)假課程甲',
                    ],
                ],
            ],
        ]),
        'https://nouapp.nou.edu.tw/device/compliant/qryper/index' => Http::response(
            <<<'HTML'
            <?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><div id="container"><div class="year-box"><div class="year">115學年上學期</div></div><div class="accordion" id="accordion-courses"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">假課程甲(網路面授)</button></h2><div class="accordion-body p-0"><div class="detail">班級類型：網路面授</div><div class="detail">授課教師：假老師</div><div class="detail">上課時間：1900~2050</div></div></div></div></div></body></html>
            HTML,
        ),
        'https://nouapp.nou.edu.tw/device/compliant/qryexm/index' => Http::response(
            <<<'HTML'
            <?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><div id="container"><div class="year-box"><div class="year">115學年上學期</div></div><div class="accordion" id="accordion-courses-exmtime"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">考試時間</button></h2><div class="accordion-body p-0"><div class="accordion" id="accordion-courses"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">期中考(正考)</button></h2><div class="accordion-body p-0"><div class="title">◉ 假課程甲</div><div class="detail"><div>日期：2026年11月07日(星期六)</div></div></div></div></div></div></div></div></div></body></html>
            HTML,
        ),
    ]);

    fakeCourseSchoolPortalInfoSessions();

    $response = get('/api/courses/9001/school-portal-info', [
        'Accept' => 'application/json',
    ]);

    $response->assertSuccessful();
    $response->assertJsonPath('classSessionInfo.teacher', '假老師');
    $response->assertJsonPath('classSessionInfo.classTime', '1900~2050');
    $response->assertJsonPath('examInfo.schedules.0.category', '期中考(正考)');
    $response->assertJsonPath('examInfo.schedules.0.date', '2026年11月07日(星期六)');
});

it('returns nulls when the course is not found', function () {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'data' => ['list' => []],
        ]),
    ]);

    fakeCourseSchoolPortalInfoSessions();

    $response = get('/api/courses/does-not-exist/school-portal-info', [
        'Accept' => 'application/json',
    ]);

    $response->assertSuccessful();
    $response->assertJsonPath('classSessionInfo', null);
    $response->assertJsonPath('examInfo', null);
});
