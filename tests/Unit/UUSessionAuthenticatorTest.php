<?php

use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use App\Services\AccountActiveProfile;
use App\Services\AccountCredentialsStore;
use App\Services\UUProfileSession;
use App\Services\UUProxyClient;
use App\Services\UUSessionAuthenticator;
use App\Services\UUSessionStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery as MockeryManager;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

it('syncs current course when reauthentication succeeds', function () {
    $proxyClient = MockeryManager::mock(UUProxyClient::class);
    $profileSession = MockeryManager::mock(UUProfileSession::class);
    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $accountCredentialsStore = MockeryManager::mock(AccountCredentialsStore::class);
    $activeProfile = new AccountActiveProfile;
    $activeProfile->set(42);

    $accountCredentialsStore->shouldReceive('get')
        ->once()
        ->andReturn(['username' => 'u', 'password' => 'p']);

    $authenticator = MockeryManager::mock(UUSessionAuthenticator::class.'[attemptLogin]', [
        $proxyClient,
        $profileSession,
        $sessionStore,
        $accountCredentialsStore,
        $activeProfile,
        $this->app->make('session.store'),
    ]);

    $authenticator->shouldReceive('attemptLogin')
        ->once()
        ->andReturn(['ok' => true, 'message' => '']);

    $syncCurrentCourse = MockeryManager::mock(SyncCurrentCourse::class);
    $syncCurrentCourse->shouldReceive('__invoke')
        ->once()
        ->withArgs(function ($cid, $force) {
            return $cid === '10050266'
                && $force === true;
        });

    $this->app->instance(SyncCurrentCourse::class, $syncCurrentCourse);

    $this->app->make('session.store')->put('hungu.current_course_id.42', '10050266');

    $result = $authenticator->attemptRememberedLogin();

    expect($result)->toBeTrue();
});
