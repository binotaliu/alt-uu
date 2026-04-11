<?php

use App\Models\PlaybackProgress;
use App\Services\UUSessionStore;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\Fluent\AssertableJson;
use Mockery as MockeryManager;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\postJson;
use function Pest\Laravel\withCookie;

it('uploads reading time through proxy endpoint and stores playback progress', function () {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=get-server-time*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['server_time' => '2026-03-14 10:00:00'],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=set-read-node-history*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['seconds' => 120],
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

    Cache::put('alt-uu:courses:path-info:1001', ['cached' => true]);

    $response = postJson('/study-time', [
        'cid' => '1001',
        'activityId' => 'N-1',
        'url' => 'https://uu.nou.edu.tw/material/lesson-1.html',
        'seconds' => 120,
        'positionSeconds' => 42.5,
    ]);

    $response->assertSuccessful();
    $response->assertJsonPath('ok', true);
    $response->assertJsonPath('seconds', 120);
    expect(Cache::has('alt-uu:courses:path-info:1001'))->toBeFalse();

    assertDatabaseHas('playback_progress', [
        'cid' => '1001',
        'activity_id' => 'N-1',
        'duration_seconds' => 120,
        'position_seconds' => 42.5,
        'hungu_upload_success' => true,
    ]);

    Http::assertSent(function (HttpRequest $request): bool {
        if (! str_contains($request->url(), 'action=set-read-node-history')) {
            return false;
        }

        parse_str($request->body(), $body);

        $headers = collect($request->headers())
            ->mapWithKeys(static fn (array $values, string $key): array => [strtolower($key) => $values]);
        $contentType = implode('; ', $headers->get('content-type', []));

        return str_contains($contentType, 'application/x-www-form-urlencoded')
            && $body === [
                'cid' => '1001',
                'url' => 'https://uu.nou.edu.tw/material/lesson-1.html',
                'st' => '2026-03-14 09:58:00',
                'activity_id' => 'N-1',
            ];
    });
});

it('retries study time upload with et when first attempt fails', function () {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=get-server-time*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['server_time' => '2026-03-14 10:00:00'],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=set-read-node-history*' => Http::sequence()
            ->push([
                'code' => 500,
                'message' => 'failed',
            ])
            ->push([
                'code' => 0,
                'message' => 'success',
                'data' => ['seconds' => 120],
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

    $response = postJson('/study-time', [
        'cid' => '1001',
        'activityId' => 'N-1',
        'url' => 'https://uu.nou.edu.tw/material/lesson-1.html',
        'seconds' => 120,
    ]);

    $response->assertSuccessful();
    $response->assertJsonPath('ok', true);
    $response->assertJsonPath('seconds', 120);

    $uploadRequests = collect(Http::recorded())
        ->filter(fn (array $record): bool => str_contains($record[0]->url(), 'action=set-read-node-history'))
        ->values();

    expect($uploadRequests)->toHaveCount(2);

    parse_str($uploadRequests[0][0]->body(), $firstBody);
    expect($firstBody)->toBe([
        'cid' => '1001',
        'url' => 'https://uu.nou.edu.tw/material/lesson-1.html',
        'st' => '2026-03-14 09:58:00',
        'activity_id' => 'N-1',
    ]);

    parse_str($uploadRequests[1][0]->body(), $secondBody);
    expect($secondBody)->toHaveKeys(['cid', 'url', 'st', 'activity_id', 'et']);
});

it('uses updated hungu cookies for subsequent proxy calls in the same request', function () {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=get-server-time*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['server_time' => '2026-03-14 10:00:00'],
        ], 200, [
            'Set-Cookie' => 'WM=rotated-cookie; path=/',
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=set-read-node-history*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['seconds' => 120],
        ]),
    ]);

    $session = [
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'stale-cookie'],
        'profile' => ['display_name' => '測試', 'username' => 's123'],
    ];
    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturnUsing(function () use (&$session) {
        return $session;
    });
    $sessionStore->shouldReceive('put')->andReturnUsing(function (array $stored) use (&$session) {
        $session = $stored;

        return null;
    });
    app()->instance(UUSessionStore::class, $sessionStore);

    $response = postJson('/study-time', [
        'cid' => '1001',
        'activityId' => 'N-1',
        'url' => 'https://uu.nou.edu.tw/material/lesson-1.html',
        'seconds' => 120,
    ]);

    $response->assertSuccessful();
    $response->assertJsonPath('ok', true);

    Http::assertSent(function (HttpRequest $request): bool {
        if (! str_contains($request->url(), 'action=set-read-node-history')) {
            return false;
        }

        $headers = collect($request->headers())
            ->mapWithKeys(static fn (array $values, string $key): array => [strtolower($key) => $values]);
        $cookieHeaders = $headers->get('cookie', []);
        $cookieHeader = implode('; ', $cookieHeaders);

        return str_contains($cookieHeader, 'WM=rotated-cookie')
            && ! str_contains($cookieHeader, 'WM=stale-cookie');
    });
});

it('returns playback progress via API endpoint', function () {
    PlaybackProgress::create([
        'cid' => '1001',
        'activity_id' => 'N-1',
        'duration_seconds' => 120,
        'position_seconds' => 42.5,
        'hungu_upload_success' => true,
    ]);

    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試', 'username' => 's123'],
    ]);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);

    $response = withCookie(config('hungu.app_boot_cookie_name'), '1')
        ->getJson('/api/playback-progress/1001/N-1');
    $response->assertSuccessful();
    $response->assertJson(fn (AssertableJson $json) => $json
        ->where('progress.cid', '1001')
        ->where('progress.activityId', 'N-1')
        ->where('progress.studySeconds', 120)
        ->where('progress.positionSeconds', 42.5)
        ->where('progress.hunguUploadSuccess', true)
        ->missing('progress.activity_id')
        ->missing('progress.duration_seconds')
        ->missing('progress.position_seconds')
        ->missing('progress.hungu_upload_success')
        ->etc());
});
