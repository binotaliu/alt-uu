<?php

use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;

use function Pest\Laravel\get;

it('maps course homeworks with action and result urls', function () {
    $studentId = fake()->numerify('s#####');
    $type = fake()->randomElement(['personal', 'group']);
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=go-course*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [],
        ]),
        'https://uu.nou.edu.tw/learn/homework/homework_list.php' => Http::response(<<<HTML
            <html>
                <script>
                    function view_homework(type, eid, obj) {
                        window.open('/learn/' + type + '/view_exemplar.php?' + eid + '+{$studentId}+{$type}', 'result', 'width=980, height=480, status=0, toolbar=0, menubar=0, resizable=1, scrollbars=1');
                    }
                </script>
                <body>
                    <div class="box2" data-type="homework">
                        <div class="title" style="width: 70%;">
                            <div class="icon-user-blue exam-type-tips" data-toggle="tooltip" title="作業型態: 個人"></div>
                            <span class="sparkpie exam-percent-tips" data-toggle="tooltip" title="100%">100,0</span>
                            &nbsp;
                            <span style="width: 230px;" title="假課程-作業 A">假課程-作業 A</span>
                        </div>
                        <div class="content">
                            <div class="data5 mooc-process">
                                <div class="process-btn pay active" onclick="togo('200001+1+tokenabc', false, this)">
                                    <div class="level1">
                                        <div class="main-text">進行作業</div>
                                        <div class="sub-text">從 2026-01-01 00:00 到 2026-01-31 23:59</div>
                                    </div>
                                </div>
                                <div class="process-btn score active" onclick="view_homework('homework', '200001+1+tokenabc', this);">
                                    <div class="level1">
                                        <div class="main-text">查看結果</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="box2" data-type="homework">
                        <div class="title" style="width: 70%;">
                            <div class="icon-user-blue exam-type-tips" data-toggle="tooltip" title="作業型態: 個人"></div>
                            <div class="sparkpie exam-percent-tips" data-toggle="tooltip" title="100%">100,0</div>
                            &nbsp;
                            <span style="width: 230px;" title="假課程-作業 B">假課程-作業 B</span>
                        </div>
                        <div class="content">
                            <div class="data5 mooc-process">
                                <div class="process-btn pay">
                                    <div class="level1">
                                        <div class="main-text">已繳作業</div>
                                        <div class="sub-text">從 2025-12-01 00:00 到 2025-12-10 23:59</div>
                                    </div>
                                </div>
                                <div class="process-btn score">
                                    <div class="level1">
                                        <div class="main-text">查看結果</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </body>
            </html>
            HTML),
    ]);

    $session = [
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試使用者', 'username' => 'u1001'],
    ];
    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn($session);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);

    $response = get('/api/courses/1001/homeworks', [
        'Accept' => 'application/json',
    ]);

    $response->assertSuccessful();
    $response->assertJsonCount(2);

    $response->assertJsonPath('0.title', '假課程-作業 A');
    $response->assertJsonPath('0.percent', '100%');
    $response->assertJsonPath('0.type', 'homework');
    $response->assertJsonPath('0.status', '進行作業');
    $response->assertJsonPath('0.window', '從 2026-01-01 00:00 到 2026-01-31 23:59');
    $response->assertJsonPath('0.actionUrl', 'https://uu.nou.edu.tw/learn/homework/exam_pre_start.php?200001+1+tokenabc+0');
    $response->assertJsonPath('0.resultUrl', "https://uu.nou.edu.tw/learn/homework/view_exemplar.php?200001+1+tokenabc+{$studentId}+{$type}");

    $response->assertJsonPath('1.title', '假課程-作業 B');
    $response->assertJsonPath('1.percent', '100%');
    $response->assertJsonPath('1.status', '已繳作業');
    $response->assertJsonPath('1.actionUrl', null);
    $response->assertJsonPath('1.resultUrl', null);

    Http::assertSent(fn ($request) => str_contains($request->url(), 'action=go-course') && str_contains($request->url(), 'cid=1001'));
    Http::assertSent(fn ($request) => $request->url() === 'https://uu.nou.edu.tw/learn/homework/homework_list.php');
});
