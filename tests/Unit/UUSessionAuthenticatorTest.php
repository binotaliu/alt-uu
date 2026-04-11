<?php

use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use App\Services\UUProfileSession;
use App\Services\UUProxyClient;
use App\Services\UURememberedCredentialsStore;
use App\Services\UUSessionAuthenticator;
use App\Services\UUSessionStore;
use Illuminate\Http\Request;
use Mockery as MockeryManager;
use Tests\TestCase;

uses(TestCase::class);

it('syncs current course when reauthentication succeeds', function () {
    $proxyClient = MockeryManager::mock(UUProxyClient::class);
    $profileSession = MockeryManager::mock(UUProfileSession::class);
    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $rememberedCredentialsStore = MockeryManager::mock(UURememberedCredentialsStore::class);

    $rememberedCredentialsStore->shouldReceive('get')
        ->once()
        ->andReturn(['username' => 'u', 'password' => 'p']);

    $authenticator = MockeryManager::mock(UUSessionAuthenticator::class.'[attemptLogin]', [
        $proxyClient,
        $profileSession,
        $sessionStore,
        $rememberedCredentialsStore,
    ]);

    $authenticator->shouldReceive('attemptLogin')
        ->once()
        ->andReturn(['ok' => true, 'message' => '']);

    $syncCurrentCourse = MockeryManager::mock(SyncCurrentCourse::class);
    $syncCurrentCourse->shouldReceive('__invoke')
        ->once()
        ->withArgs(function ($request, $cid, $force) {
            return $request instanceof Request
                && $cid === '10050266'
                && $force === true;
        });

    $this->app->instance(SyncCurrentCourse::class, $syncCurrentCourse);

    $request = Request::create('/test', 'GET');
    $request->setLaravelSession($this->app->make('session.store'));
    $request->session()->put('hungu.current_course_id', '10050266');

    $result = $authenticator->attemptRememberedLogin($request);

    expect($result)->toBeTrue();
});
