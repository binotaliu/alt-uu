<?php

use AltUU\Domains\Diagnostics\Enums\ConnectivityServiceEnum;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    enableDiagnosticRecording();
});

it('lists the services to check without making any http calls', function () {
    Http::fake();

    $this->getJson('/api/diagnostics/connectivity/services')
        ->assertOk()
        ->assertJsonCount(7, 'services')
        ->assertJsonPath('services.0.service', ConnectivityServiceEnum::Hungu->value)
        ->assertJsonPath('services.0.isReference', false)
        ->assertJsonPath('services.4.service', ConnectivityServiceEnum::Google->value)
        ->assertJsonPath('services.4.isReference', true);

    Http::assertNothingSent();
});

it('checks a reference service and reports it reachable', function () {
    Http::fake(['*' => Http::response('ok', 200)]);

    $this->getJson('/api/diagnostics/connectivity/google')
        ->assertOk()
        ->assertJsonPath('service', 'google')
        ->assertJsonPath('reachable', true);
});

it('checks a single service and reports it reachable', function () {
    Http::fake(['*' => Http::response('ok', 200)]);

    $this->getJson('/api/diagnostics/connectivity/hungu')
        ->assertOk()
        ->assertJsonPath('service', 'hungu')
        ->assertJsonPath('reachable', true);
});

it('marks a service unreachable on connection failure', function () {
    Http::fake(['*' => fn () => throw new ConnectionException('timed out')]);

    $this->getJson('/api/diagnostics/connectivity/hungu')
        ->assertOk()
        ->assertJsonPath('reachable', false)
        ->assertJsonPath('statusCode', null)
        ->assertJsonPath('error', fn (?string $error) => $error !== null);
});

it('treats a 4xx response as reachable', function () {
    Http::fake(['*' => Http::response('forbidden', 403)]);

    $this->getJson('/api/diagnostics/connectivity/hungu')->assertJsonPath('reachable', true);
});

it('treats a 5xx response as unreachable', function () {
    Http::fake(['*' => Http::response('error', 500)]);

    $this->getJson('/api/diagnostics/connectivity/hungu')->assertJsonPath('reachable', false);
});

it('returns 404 for an unknown service', function () {
    $this->getJson('/api/diagnostics/connectivity/not-a-service')
        ->assertNotFound();
});

it('exposes the diagnostics endpoints without requiring an active Hungu session', function () {
    Http::fake(['*' => Http::response('ok', 200)]);

    $this->getJson('/api/diagnostics/connectivity/services')->assertOk();
    $this->getJson('/api/diagnostics/connectivity/iap')->assertOk();
});
