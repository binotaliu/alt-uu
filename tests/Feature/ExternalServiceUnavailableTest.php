<?php

use App\Services\UUSessionStore;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;

use function Pest\Laravel\get;

it('wraps an upstream connection failure as a 503 instead of a raw 500', function () {
    Http::fake([
        '*' => fn () => throw new ConnectionException('cURL error 28: Connection timed out'),
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

    $response = get(route('api.courses.index'), [
        'Accept' => 'application/json',
    ]);

    $response->assertStatus(503)
        ->assertJsonPath('code', 'external_service_unavailable');
});
