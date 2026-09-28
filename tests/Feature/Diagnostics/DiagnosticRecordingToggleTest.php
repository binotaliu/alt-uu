<?php

declare(strict_types=1);

use App\Models\DiagnosticEvent;
use App\Services\Diagnostics\DiagnosticRecorder;
use Illuminate\Support\Facades\Date;

use function Pest\Laravel\getJson;
use function Pest\Laravel\putJson;

it('reports recording as off until the user turns it on', function () {
    getJson(route('api.diagnostics.log.recording.show'))
        ->assertSuccessful()
        ->assertJsonPath('available', true)
        ->assertJsonPath('recording', false)
        ->assertJsonPath('expiresAt', null)
        ->assertJsonPath('windowMinutes', 30)
        ->assertJsonPath('retentionDays', 14);
});

it('opens a bounded window when switched on', function () {
    $response = putJson(route('api.diagnostics.log.recording.update'), ['enabled' => true]);

    $response->assertSuccessful()
        ->assertJsonPath('recording', true);

    $expiresAt = Date::parse($response->json('expiresAt'));

    expect($expiresAt->greaterThan(now()))->toBeTrue()
        ->and($expiresAt->lessThanOrEqualTo(now()->addMinutes(30)))->toBeTrue();
});

it('records once the window is open and stops once it closes', function () {
    putJson(route('api.diagnostics.log.recording.update'), ['enabled' => true])
        ->assertSuccessful();

    getJson('/api/config')->assertSuccessful();

    expect(DiagnosticEvent::count())->toBeGreaterThan(0);

    DiagnosticEvent::query()->delete();
    $this->travel(31)->minutes();
    app()->forgetInstance(DiagnosticRecorder::class);

    getJson('/api/config')->assertSuccessful();

    expect(DiagnosticEvent::count())->toBe(0);
});

it('can be switched off before the window elapses', function () {
    putJson(route('api.diagnostics.log.recording.update'), ['enabled' => true]);
    putJson(route('api.diagnostics.log.recording.update'), ['enabled' => false])
        ->assertSuccessful()
        ->assertJsonPath('recording', false)
        ->assertJsonPath('expiresAt', null);

    app()->forgetInstance(DiagnosticRecorder::class);
    DiagnosticEvent::query()->delete();

    getJson('/api/config')->assertSuccessful();

    expect(DiagnosticEvent::count())->toBe(0);
});

it('rejects a request without the enabled flag', function () {
    putJson(route('api.diagnostics.log.recording.update'), [])->assertStatus(422);
});

it('still lets the log be read and exported while recording is off', function () {
    enableDiagnosticRecording();
    getJson('/api/config')->assertSuccessful();
    app(DiagnosticRecorder::class)->setRecording(false);
    app()->forgetInstance(DiagnosticRecorder::class);

    getJson(route('api.diagnostics.log.index'))
        ->assertSuccessful()
        ->assertJsonPath('recordingEnabled', false);

    expect(DiagnosticEvent::count())->toBeGreaterThan(0);
});

it('drops aged rows when the log is read, even with recording off', function () {
    DiagnosticEvent::factory()->create(['occurred_at' => now()->subDays(20)]);
    DiagnosticEvent::factory()->create(['occurred_at' => now()->subDays(2)]);

    $response = getJson(route('api.diagnostics.log.index'))->assertSuccessful();

    expect($response->json('total'))->toBe(1)
        ->and(DiagnosticEvent::count())->toBe(1);
});
