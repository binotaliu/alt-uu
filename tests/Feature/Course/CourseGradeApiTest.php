<?php

use App\Services\SchoolPortalSessionStore;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;

use function Pest\Laravel\get;

function fakeCourseGradeSessions(): void
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

it('returns the matching school portal grade for a course', function () {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'data' => [
                'list' => [
                    [
                        'course_id' => '9001',
                        'title' => '(114下)假課程甲',
                    ],
                ],
            ],
        ]),
        'https://nouapp.nou.edu.tw/device/compliant/qryscore/index' => Http::response(
            <<<'HTML'
            <?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><div id="container"><div class="year-box"><div class="year">114學年下學期</div></div><div class="accordion"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">假課程甲</button></h2><div class="accordion-body p-0"><div class="detail">學分數：<span class="">3</span></div><div class="detail">第一次平時成績：<span class="text-danger">缺</span></div><div class="detail">第二次平時成績：<span class="text-danger">缺</span></div><div class="detail">學習參與成績：<span class="">90</span></div><div class="detail">平時成績平均：<span class="text-danger">30</span></div><div class="detail">期中成績：<span class="">70</span></div><div class="detail">期末成績：<span class="">無資料</span></div><div class="detail">學期成績：<span class="">無資料</span></div></div></div></div></div></body></html>
            HTML,
        ),
    ]);

    fakeCourseGradeSessions();

    $response = get('/api/courses/9001/grades', [
        'Accept' => 'application/json',
    ]);

    $response->assertSuccessful();
    $response->assertJsonPath('grade.courseName', '假課程甲');
    $response->assertJsonPath('grade.semesterLabel', '114學年下學期');
    $response->assertJsonPath('grade.credits', '3');
    $response->assertJsonPath('grade.midtermScore', '70');
    $response->assertJsonPath('grade.finalScore', '無資料');
});

it('returns a null grade when the course is not found', function () {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'data' => ['list' => []],
        ]),
    ]);

    fakeCourseGradeSessions();

    $response = get('/api/courses/does-not-exist/grades', [
        'Accept' => 'application/json',
    ]);

    $response->assertSuccessful();
    $response->assertJsonPath('grade', null);
});
