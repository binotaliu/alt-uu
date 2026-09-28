<?php

use App\Services\AccountCredentialsStore;
use App\Services\SchoolPortalProxyClient;
use App\Services\SchoolPortalSessionStore;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    config([
        'school_portal.base_url' => 'https://nouapp.nou.edu.tw',
        'school_portal.reviewer_username' => 'reviewer',
        'school_portal.reviewer_base_url' => 'https://alt-uu-staging.binota.org',
    ]);
});

it('routes login for a reviewer-prefixed username to the reviewer base url', function () {
    Http::fake([
        'https://alt-uu-staging.binota.org/*' => Http::response('', 200, ['Set-Cookie' => 'sid=abc']),
    ]);

    $sessionStore = MockeryManager::mock(SchoolPortalSessionStore::class);
    $sessionStore->shouldReceive('put')->andReturnNull();
    $accountCredentialsStore = MockeryManager::mock(AccountCredentialsStore::class);

    $client = new SchoolPortalProxyClient($sessionStore, $accountCredentialsStore);
    $client->login('reviewer2', 'anypass');

    Http::assertSent(fn ($request) => str_starts_with($request->url(), 'https://alt-uu-staging.binota.org'));
    Http::assertNotSent(fn ($request) => str_starts_with($request->url(), 'https://nouapp.nou.edu.tw'));
});

it('routes login for a non-reviewer username to the real base url', function () {
    Http::fake([
        'https://nouapp.nou.edu.tw/*' => Http::response('', 200, ['Set-Cookie' => 'sid=abc']),
    ]);

    $sessionStore = MockeryManager::mock(SchoolPortalSessionStore::class);
    $sessionStore->shouldReceive('put')->andReturnNull();
    $accountCredentialsStore = MockeryManager::mock(AccountCredentialsStore::class);

    $client = new SchoolPortalProxyClient($sessionStore, $accountCredentialsStore);
    $client->login('student123', 'anypass');

    Http::assertSent(fn ($request) => str_starts_with($request->url(), 'https://nouapp.nou.edu.tw'));
    Http::assertNotSent(fn ($request) => str_starts_with($request->url(), 'https://alt-uu-staging.binota.org'));
});

it('routes the first fetch (no existing session) to the reviewer base url when remembered credentials belong to the reviewer', function () {
    Http::fake([
        'https://alt-uu-staging.binota.org/*' => Http::response('<html></html>', 200),
    ]);

    $sessionStore = MockeryManager::mock(SchoolPortalSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn(null);
    $sessionStore->shouldReceive('put')->andReturnNull();

    $accountCredentialsStore = MockeryManager::mock(AccountCredentialsStore::class);
    $accountCredentialsStore->shouldReceive('get')->andReturn(['username' => 'reviewer', 'password' => 'p']);

    $client = new SchoolPortalProxyClient($sessionStore, $accountCredentialsStore);
    $client->fetchHtmlPage('/device/compliant/qryscore/index');

    Http::assertSent(fn ($request) => str_starts_with($request->url(), 'https://alt-uu-staging.binota.org'));
});

it('routes the first fetch (no existing session) to the real base url when remembered credentials are not the reviewer', function () {
    Http::fake([
        'https://nouapp.nou.edu.tw/*' => Http::response('<html></html>', 200),
    ]);

    $sessionStore = MockeryManager::mock(SchoolPortalSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn(null);
    $sessionStore->shouldReceive('put')->andReturnNull();

    $accountCredentialsStore = MockeryManager::mock(AccountCredentialsStore::class);
    $accountCredentialsStore->shouldReceive('get')->andReturn(['username' => 'student123', 'password' => 'p']);

    $client = new SchoolPortalProxyClient($sessionStore, $accountCredentialsStore);
    $client->fetchHtmlPage('/device/compliant/qryscore/index');

    Http::assertSent(fn ($request) => str_starts_with($request->url(), 'https://nouapp.nou.edu.tw'));
});
