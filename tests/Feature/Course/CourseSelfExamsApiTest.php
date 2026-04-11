<?php

use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;

use function Pest\Laravel\get;

it('maps self exams with nested retake button and view result urls', function () {
    $firstExamId = fake()->numerify('e#####').'+2+'.fake()->bothify('token-########');
    $secondExamId = fake()->numerify('e#####').'+1+'.fake()->bothify('token-########');

    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=go-course*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [],
        ]),
        'https://uu.nou.edu.tw/learn/exam/co_self_exam_list.php' => Http::response(<<<HTML
            <html>
                <body>
                    <div class="box2" data-type="self-exam">
                        <div class="title" style="width: 70%;">
                            <span style="width: 230px;" title="示範自我測驗 A">示範自我測驗 A</span>
                        </div>
                        <div class="content">
                            <div class="data5 mooc-process">
                                <div class="process-btn pay active" style="width: 50%;">
                                    <div class="level1 active">
                                        <div class="main-text">進行測驗</div>
                                        <div class="sub-text">從 即日起 到 無限期</div>
                                    </div>
                                    <div class="level2" style="display: none;">
                                        <div class="btn btn-blue" onclick="togo('{$firstExamId}', false, this)">重新測驗(已考 1 次)</div>
                                        <div class="btn btn-blue disabled">續考</div>
                                    </div>
                                </div>
                                <div class="process-btn score active" onclick="viewResult('{$firstExamId}');" style="width: 50%;">
                                    <div class="level1">
                                        <div class="main-text">查看結果</div>
                                        <div class="sub-text">繳交後公布</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="box2" data-type="self-exam">
                        <div class="title" style="width: 70%;">
                            <span style="width: 230px;" title="示範自我測驗 B">示範自我測驗 B</span>
                        </div>
                        <div class="content">
                            <div class="data5 mooc-process">
                                <div class="process-btn pay active" onclick="togo('{$secondExamId}', false, this)" style="width: 50%;">
                                    <div class="level1">
                                        <div class="main-text">進行測驗</div>
                                        <div class="sub-text">從 即日起 到 無限期</div>
                                    </div>
                                    <div class="level2" style="display: none;">
                                        <div class="btn btn-blue" onclick="togo('{$secondExamId}', false, this)">重新測驗(已考 0 次)</div>
                                        <div class="btn btn-blue disabled">續考</div>
                                    </div>
                                </div>
                                <div class="process-btn score" style="width: 50%;">
                                    <div class="level1">
                                        <div class="main-text">查看結果</div>
                                        <div class="sub-text">繳交後公布</div>
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
        'ticket' => 'ticket-2',
        'session_idx' => 'idx-2',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試使用者', 'username' => 'u1002'],
    ];
    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn($session);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);

    $response = get('/api/courses/4242/self-exams', [
        'Accept' => 'application/json',
    ]);

    $response->assertSuccessful();
    $response->assertJsonCount(2);

    $response->assertJsonPath('0.title', '示範自我測驗 A');
    $response->assertJsonPath('0.actionUrl', 'https://uu.nou.edu.tw/learn/exam/exam_start.php?'.$firstExamId.'+0');
    $response->assertJsonPath('0.resultUrl', 'https://uu.nou.edu.tw/learn/exam/view_result.php?'.$firstExamId);

    $response->assertJsonPath('1.title', '示範自我測驗 B');
    $response->assertJsonPath('1.actionUrl', 'https://uu.nou.edu.tw/learn/exam/exam_start.php?'.$secondExamId.'+0');
    $response->assertJsonPath('1.resultUrl', null);

    Http::assertSent(fn ($request) => str_contains($request->url(), 'action=go-course') && str_contains($request->url(), 'cid=4242'));
    Http::assertSent(fn ($request) => $request->url() === 'https://uu.nou.edu.tw/learn/exam/co_self_exam_list.php');
});
