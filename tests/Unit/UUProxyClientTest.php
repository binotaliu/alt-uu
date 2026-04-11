<?php

use App\Services\UUCrypto;
use App\Services\UUProxyClient;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;
use Tests\TestCase;

uses(TestCase::class);

it('retries request once after 403 when reauthentication succeeds', function () {
    Http::fakeSequence()
        ->push(['code' => 401], 403)
        ->push(['code' => 0, 'data' => ['ok' => true]], 200);

    $crypto = MockeryManager::mock(UUCrypto::class);
    $crypto->shouldReceive('encryptImmediately')->andReturn('x');

    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn([
        'base_url' => 'https://example.com/xmlapi/index.php',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => '',
        'cookies' => [],
    ]);
    $sessionStore->shouldReceive('put')->andReturnNull();

    $client = new UUProxyClient($crypto, $sessionStore);

    $reauthAttempted = false;
    $client->setReauthenticationHandler(function () use (&$reauthAttempted) {
        $reauthAttempted = true;

        return true;
    });

    $result = $client->request('my-course-list');

    expect($reauthAttempted)->toBeTrue();
    expect($result['payload']['code'])->toBe(0);
    expect($result['payload']['data']['ok'])->toBeTrue();
});

it('does not retry after 403 when reauthentication fails', function () {
    Http::fakeSequence()
        ->push(['code' => 401], 403);

    $crypto = MockeryManager::mock(UUCrypto::class);
    $crypto->shouldReceive('encryptImmediately')->andReturn('x');

    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn([
        'base_url' => 'https://example.com/xmlapi/index.php',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => '',
        'cookies' => [],
    ]);
    $sessionStore->shouldReceive('put')->andReturnNull();

    $client = new UUProxyClient($crypto, $sessionStore);

    $reauthAttempted = false;
    $client->setReauthenticationHandler(function () use (&$reauthAttempted) {
        $reauthAttempted = true;

        return false;
    });

    $result = $client->request('my-course-list');

    expect($reauthAttempted)->toBeTrue();
    expect($result['payload']['code'])->toBe(401);
});
