<?php

use App\Services\SchoolPortalSessionStore;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;

use function Pest\Laravel\get;

function fakeExamAgendaSession(): void
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

it('returns only 正考 exams with a scheduled time, ordered by time ascending', function () {
    Http::fake([
        'https://nouapp.nou.edu.tw/device/compliant/qryexm/index' => Http::response(
            <<<'HTML'
            <?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><div id="container"><div class="year-box"><div class="year">115學年上學期</div></div><div class="accordion" id="accordion-courses-exmtime"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">考試時間</button></h2><div class="accordion-body p-0"><div class="accordion" id="accordion-courses"><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">期中考(正考)</button></h2><div class="accordion-body p-0"><div class="title">◉ 假課程甲</div><div class="detail"><div>日期：2026年11月07日(星期六)</div></div><div class="detail"><div>時間：1500~1610第5節</div></div><div class="detail"><div>教室代號：41Z101</div></div><div class="title">◉ 假課程丙</div><div class="detail"><div>說明：統一命題非集中考試</div></div></div></div><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">期末考(正考)</button></h2><div class="accordion-body p-0"><div class="title">◉ 假課程乙</div><div class="detail"><div>日期：2026年11月05日(星期三)</div></div><div class="detail"><div>時間：0900~1040第2節</div></div><div class="detail"><div>教室代號：41Z102</div></div></div></div><div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button">期中考(補考)</button></h2><div class="accordion-body p-0"><div class="title">◉ 假課程甲</div><div class="detail"><div>日期：2026年12月01日(星期二)</div></div><div class="detail"><div>時間：1000~1140</div></div><div class="detail"><div>教室代號：41Z103</div></div></div></div></div></div></div></div></div></body></html>
            HTML,
        ),
    ]);

    fakeExamAgendaSession();

    $response = get('/api/exam-agenda', ['Accept' => 'application/json']);

    $response->assertSuccessful();
    // 假課程丙's 正考 entry has no time (a unified/non-scheduled exam, just a
    // free-form note) and 假課程甲's 補考 entry isn't a 正考 — neither belongs
    // in the agenda.
    $response->assertJsonCount(2, 'items');
    $response->assertJsonPath('items.0.courseName', '假課程乙');
    $response->assertJsonPath('items.0.time', '0900~1040第2節');
    $response->assertJsonPath('items.0.room', '41Z102');
    $response->assertJsonPath('items.1.courseName', '假課程甲');
    $response->assertJsonPath('items.1.time', '1500~1610第5節');
});

it('returns an empty list when the portal has no exam info', function () {
    Http::fake([
        'https://nouapp.nou.edu.tw/device/compliant/qryexm/index' => Http::response('', 500),
    ]);

    fakeExamAgendaSession();

    $response = get('/api/exam-agenda', ['Accept' => 'application/json']);

    $response->assertSuccessful();
    $response->assertJsonPath('items', []);
});
