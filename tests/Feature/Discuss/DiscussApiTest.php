<?php

use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\get;
use function Pest\Laravel\patchJson;
use function Pest\Laravel\postJson;

it('can load discuss boards from dedicated endpoint', function () {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=get-board-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'list' => [
                    [
                        'board_id' => 'B-1',
                        'board_name' => '課程討論',
                        'subject_cnt' => 3,
                        'is_bulletin' => 0,
                        'read_flag' => 0,
                    ],
                ],
            ],
        ]),
    ]);

    $session = [
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試', 'username' => 's123'],
    ];
    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn($session);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);

    $response = get('/api/discuss/boards?cid=1001', [
        'Accept' => 'application/json',
    ]);

    $response->assertSuccessful();
    $response->assertJsonPath('courseId', '1001');
    $response->assertJsonPath('boards.0.boardId', 'B-1');
    $response->assertJsonPath('boards.0.boardName', '課程討論');
    $response->assertJsonPath('boards.0.subjectCount', 3);
    $response->assertJsonPath('boards.0.allowPost', true);
    $response->assertJsonPath('boards.0.hasNewPost', true);

    Http::assertNotSent(fn ($request) => str_contains($request->url(), 'action=my-course-list'));
    Http::assertSent(fn ($request) => str_contains($request->url(), 'action=get-board-list'));
});

it('fetches thread posts and whispers from dedicated endpoint and sanitizes content', function () {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=get-board-reply-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'list' => [
                    [
                        'floor' => 1,
                        'node' => 'N-POST-1',
                        'realname' => '測試',
                        'content' => '<script>alert(1)</script>hello',
                        'post_date' => '2024-01-01',
                        'push' => 3,
                        'hit' => 1,
                        'whispercnt' => 1,
                        'i_pushed' => 1,
                    ],
                ],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=board-whisper-handler*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'list' => [
                    ['wid' => 'w-1', 'realname' => '小明', 'content' => '<script>alert(1)</script>hi', 'create_time_description' => '1 分鐘前'],
                ],
            ],
        ]),
    ]);

    $session = [
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試', 'username' => 's123'],
    ];
    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn($session);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);

    $response = get('/api/discuss/posts?cid=1001&bid=B-1&nid=N-99', [
        'Accept' => 'application/json',
    ]);

    $response->assertSuccessful();
    $response->assertJsonPath('courseId', '1001');
    $response->assertJsonPath('boardId', 'B-1');
    $response->assertJsonPath('nodeId', 'N-99');
    $response->assertJsonPath('posts.0.content', '<p>hello</p>');
    $response->assertJsonPath('posts.0.push', 3);
    $response->assertJsonPath('posts.0.liked', true);
    $response->assertJsonPath('posts.0.whisperCount', 1);
    $response->assertJsonPath('posts.0.whispers.0.content', '<script>alert(1)</script>hi');
    $response->assertJsonPath('posts.0.node', 'N-POST-1');
    $response->assertJsonMissing(['whispers']);

    Http::assertSent(fn ($request) => str_contains($request->url(), 'action=get-board-reply-list'));
    Http::assertSent(fn ($request) => str_contains($request->url(), 'action=board-whisper-handler') && str_contains($request->url(), 'nid=N-POST-1'));
});

it('returns not found for removed legacy aggregate endpoint', function () {
    $session = [
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試', 'username' => 's123'],
    ];
    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn($session);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);

    get('/api/discuss', [
        'Accept' => 'application/json',
    ])->assertNotFound();
});

it('can create/update/delete/like discuss posts and manage whispers', function () {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=add-course-post*' => Http::response(['code' => 0, 'message' => 'ok', 'data' => ['post_id' => 'P-1']]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=mod-course-post*' => Http::response(['code' => 0, 'message' => 'ok']),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=del-course-post*' => Http::response(['code' => 0, 'message' => 'ok']),
        'https://uu.nou.edu.tw/mooc/controllers/forum_ajax.php*' => Http::response(['code' => 0, 'message' => 'ok']),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=board-whisper-handler*' => Http::response(['code' => 0, 'message' => 'ok', 'data' => ['list' => []]]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=set-forum-read*' => Http::response(['code' => 0, 'message' => 'ok']),
    ]);

    $session = [
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試', 'username' => 's123'],
    ];
    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn($session);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);

    $createResponse = postJson('/api/discuss/posts', [
        'bid' => 'B-1',
        'subject' => '新文章',
        'content' => '文章內容',
    ]);
    $createResponse->assertSuccessful();
    $createResponse->assertJsonPath('data.post_id', 'P-1');

    $updateResponse = patchJson('/api/discuss/posts/P-1', [
        'subject' => '更新標題',
        'content' => '更新內容',
    ]);
    $updateResponse->assertSuccessful();

    $deleteResponse = deleteJson('/api/discuss/posts/P-1');
    $deleteResponse->assertSuccessful();

    $likeResponse = postJson('/api/discuss/posts/N-1/like', [
        'bid' => 'B-1',
    ]);
    $likeResponse->assertSuccessful();

    $unlikeResponse = postJson('/api/discuss/posts/N-1/unlike', [
        'bid' => 'B-1',
    ]);
    $unlikeResponse->assertSuccessful();

    $createWhisper = postJson('/api/discuss/whispers', [
        'bid' => 'B-1',
        'nid' => 'N-1',
        'content' => '留言',
    ]);
    $createWhisper->assertSuccessful();

    $updateWhisper = patchJson('/api/discuss/whispers/W-1', [
        'bid' => 'B-1',
        'nid' => 'N-1',
        'content' => '編輯留言',
    ]);
    $updateWhisper->assertSuccessful();

    $deleteWhisper = deleteJson('/api/discuss/whispers/W-1', [
        'bid' => 'B-1',
        'nid' => 'N-1',
    ]);
    $deleteWhisper->assertSuccessful();

    $setRead = postJson('/api/discuss/read/P-1');
    $setRead->assertSuccessful();

    Http::assertSent(fn ($request) => str_contains($request->url(), 'action=add-course-post'));
    Http::assertSent(fn ($request) => str_contains($request->url(), 'action=mod-course-post'));
    Http::assertSent(fn ($request) => str_contains($request->url(), 'action=del-course-post'));
    Http::assertSent(fn ($request) => str_contains($request->url(), '/mooc/controllers/forum_ajax.php'));
    Http::assertSent(fn ($request) => str_contains($request->url(), 'action=board-whisper-handler'));
    Http::assertSent(fn ($request) => str_contains($request->url(), 'action=set-forum-read'));
});
