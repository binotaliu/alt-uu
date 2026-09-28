<?php

use App\Services\SchoolPortalSessionStore;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;

use function Pest\Laravel\get;

function fakeAllCourseGradesSession(): void
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

it('returns every grade the portal has, most recent semester first, deduping the current semester', function () {
    Http::fake([
        'https://nouapp.nou.edu.tw/device/compliant/qryscore/index' => Http::response(
            <<<'HTML'
            <?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><div id="container"><div class="year-box"><div class="year">114學年下學期</div></div><div class="accordion"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">假課程甲</button></h2><div class="accordion-body p-0"><div class="detail">學分數：<span class="">3</span></div><div class="detail">期中成績：<span class="">70</span></div><div class="detail">學期成績：<span class="">無資料</span></div></div></div></div></div></body></html>
            HTML,
        ),
        'https://nouapp.nou.edu.tw/device/compliant/qryscore2/index' => Http::response(
            <<<'HTML'
            <?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><div id="container"><div class="accordion"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">115暑期：總計修讀 2 學分</button></h2><div class="accordion-body p-0"><div class="detail">假課程乙：<span class="">63</span> (2學分)</div></div></div><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">114下學期：總計修讀 3 學分</button></h2><div class="accordion-body p-0"><div class="detail">假課程甲：<span class="">無資料</span> (3學分)</div></div></div></div></div></body></html>
            HTML,
        ),
    ]);

    fakeAllCourseGradesSession();

    $response = get('/api/grades', ['Accept' => 'application/json']);

    $response->assertSuccessful();
    $response->assertJsonCount(2, 'grades');
    $response->assertJsonPath('grades.0.courseName', '假課程乙');
    $response->assertJsonPath('grades.0.semesterLabel', '115暑期');
    $response->assertJsonPath('grades.1.courseName', '假課程甲');
    $response->assertJsonPath('grades.1.semesterLabel', '114學年下學期');
    $response->assertJsonPath('grades.1.midtermScore', '70');
});

it('returns an empty list when the portal has no grades', function () {
    Http::fake([
        'https://nouapp.nou.edu.tw/device/compliant/qryscore/index' => Http::response('', 500),
        'https://nouapp.nou.edu.tw/device/compliant/qryscore2/index' => Http::response('', 500),
    ]);

    fakeAllCourseGradesSession();

    $response = get('/api/grades', ['Accept' => 'application/json']);

    $response->assertSuccessful();
    $response->assertJsonPath('grades', []);
});
