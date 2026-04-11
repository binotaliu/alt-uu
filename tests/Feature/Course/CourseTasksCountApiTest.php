<?php

use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;

use function Pest\Laravel\get;

it('returns merged pending homeworks and unread articles counts', function () {
    Http::fake([
        'https://uu.nou.edu.tw/learn/my_homework.php' => Http::response(<<<'HTML'
            <html>
            <body>
                <div class="data2">
                    <table class="table subject">
                        <tr data-bid="10050559">
                            <td class="t4"><div class="text-left">10050559</div></td>
                            <td><div class="text-left">Modern History Course</div></td>
                            <td class="t4 hidden-phone"><div class="text-center">2</div></td>
                            <td class="t4 hidden-phone"><div class="text-center">1</div></td>
                            <td class="t3"><button class="btn btn-gray">Go</button></td>
                        </tr>
                        <tr data-bid="10048231">
                            <td class="t4"><div class="text-left">10048231</div></td>
                            <td><div class="text-left">European History Course</div></td>
                            <td class="t4 hidden-phone"><div class="text-center">3</div></td>
                            <td class="t4 hidden-phone"><div class="text-center">2</div></td>
                            <td class="t3"><button class="btn btn-gray">Go</button></td>
                        </tr>
                    </table>
                </div>
            </body>
            </html>
            HTML),
        'https://uu.nou.edu.tw/learn/my_forum.php' => Http::response(<<<'HTML'
            <html>
            <body>
                <div class="data2">
                    <table class="table subject">
                        <tr>
                            <td class="t4"><div class="text-left">10048231</div></td>
                            <td><div class="text-left">European History Course</div></td>
                            <td class="t4 hidden-phone"><div class="text-center">5</div></td>
                            <td class="t3"><button class="btn btn-gray">Go</button></td>
                        </tr>
                        <tr>
                            <td class="t4"><div class="text-left">10099999</div></td>
                            <td><div class="text-left">Another Course</div></td>
                            <td class="t4 hidden-phone"><div class="text-center">3</div></td>
                            <td class="t3"><button class="btn btn-gray">Go</button></td>
                        </tr>
                    </table>
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
        'profile' => ['display_name' => 'Test User', 'username' => 'u1001'],
    ];

    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn($session);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);

    $response = get(route('api.courses.tasks-count'), [
        'Accept' => 'application/json',
    ]);

    $response->assertOk();
    $response->assertJsonCount(3);

    // Course 10050559: 1 pending homework, 0 unread articles
    $response->assertJsonPath('0.courseId', '10050559');
    $response->assertJsonPath('0.pendingHomeworks', 1);
    $response->assertJsonPath('0.unreadArticles', 0);

    // Course 10048231: 2 pending homeworks, 5 unread articles
    $response->assertJsonPath('1.courseId', '10048231');
    $response->assertJsonPath('1.pendingHomeworks', 2);
    $response->assertJsonPath('1.unreadArticles', 5);

    // Course 10099999: 0 pending homeworks, 3 unread articles
    $response->assertJsonPath('2.courseId', '10099999');
    $response->assertJsonPath('2.pendingHomeworks', 0);
    $response->assertJsonPath('2.unreadArticles', 3);
});

it('returns empty array when no pending homeworks or unread articles', function () {
    Http::fake([
        'https://uu.nou.edu.tw/learn/my_homework.php' => Http::response('<html><body></body></html>'),
        'https://uu.nou.edu.tw/learn/my_forum.php' => Http::response('<html><body></body></html>'),
    ]);

    $session = [
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => [],
        'profile' => ['display_name' => 'Test User', 'username' => 'u1001'],
    ];

    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn($session);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);

    $response = get(route('api.courses.tasks-count'), [
        'Accept' => 'application/json',
    ]);

    $response->assertOk();
    $response->assertJsonCount(0);
});

it('handles malformed HTML gracefully', function () {
    Http::fake([
        'https://uu.nou.edu.tw/learn/my_homework.php' => Http::response(<<<'HTML'
            <html>
            <body>
                <div class="data2">
                    <table class="table subject">
                        <tr>
                            <td class="t4"><div>10050559</div></td>
                        </tr>
                    </table>
                </div>
            </body>
            </html>
            HTML),
        'https://uu.nou.edu.tw/learn/my_forum.php' => Http::response('<html><body></body></html>'),
    ]);

    $session = [
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => [],
        'profile' => ['display_name' => 'Test User', 'username' => 'u1001'],
    ];

    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn($session);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);

    $response = get(route('api.courses.tasks-count'), [
        'Accept' => 'application/json',
    ]);

    $response->assertOk();
    // Malformed row should be skipped
    $response->assertJsonCount(0);
});

it('handles server errors gracefully', function () {
    Http::fake([
        'https://uu.nou.edu.tw/learn/my_homework.php' => Http::response('Server Error', 502),
        'https://uu.nou.edu.tw/learn/my_forum.php' => Http::response('Server Error', 502),
    ]);

    $session = [
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => [],
        'profile' => ['display_name' => 'Test User', 'username' => 'u1001'],
    ];

    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn($session);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);

    $response = get(route('api.courses.tasks-count'), [
        'Accept' => 'application/json',
    ]);

    $response->assertOk();
    $response->assertJsonCount(0);
});

it('requires hungu session', function () {
    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn(null); // Return null instead of empty array
    $sessionStore->shouldReceive('put')->andReturnNull();
    app()->instance(UUSessionStore::class, $sessionStore);

    $response = get(route('api.courses.tasks-count'), [
        'Accept' => 'application/json',
    ]);

    $response->assertStatus(401);
});
