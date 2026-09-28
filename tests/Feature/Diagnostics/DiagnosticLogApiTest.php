<?php

declare(strict_types=1);

use AltUU\Domains\Diagnostics\Enums\DiagnosticEventTypeEnum;
use AltUU\Domains\Diagnostics\Enums\DiagnosticSourceEnum;
use App\Models\DiagnosticEvent;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\get;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

beforeEach(function () {
    enableDiagnosticRecording();
});

it('lists events newest first without needing a live session', function () {
    DiagnosticEvent::factory()->create(['summary' => 'older']);
    DiagnosticEvent::factory()->failed()->create(['summary' => 'newer']);

    $response = getJson(route('api.diagnostics.log.index'));

    $response->assertSuccessful()
        ->assertJsonPath('events.0.summary', 'newer')
        ->assertJsonPath('events.1.summary', 'older')
        ->assertJsonPath('total', 2)
        ->assertJsonPath('recordingEnabled', true);
});

it('can filter down to just the problems', function () {
    DiagnosticEvent::factory()->create(['summary' => 'fine']);
    DiagnosticEvent::factory()->upstream()->create(['summary' => 'broken']);

    $response = getJson(route('api.diagnostics.log.index', ['problemsOnly' => 1]));

    expect($response->json('events'))->toHaveCount(1)
        ->and($response->json('events.0.summary'))->toBe('broken');
});

it('accepts the client ring buffer and merges it into the same log', function () {
    $response = postJson(route('api.diagnostics.log.client-events'), [
        'events' => [
            [
                'occurredAt' => '2026-09-21T10:00:00+08:00',
                'type' => 'client.error',
                'level' => 'error',
                'summary' => 'TypeError: cannot read property of undefined',
                'op' => 'courses.list',
                'requestId' => 'a3f91c02',
                'status' => null,
                'durationMs' => null,
                'context' => ['stack' => 'at CourseListTab.vue:95'],
            ],
        ],
    ]);

    $response->assertSuccessful()->assertJsonPath('stored', 1);

    $event = DiagnosticEvent::sole();

    expect($event->source)->toBe(DiagnosticSourceEnum::Client)
        ->and($event->type)->toBe(DiagnosticEventTypeEnum::ClientError)
        ->and($event->request_id)->toBe('a3f91c02')
        ->and($event->summary)->toContain('TypeError');
});

it('rejects a client event type it does not recognise', function () {
    postJson(route('api.diagnostics.log.client-events'), [
        'events' => [[
            'occurredAt' => '2026-09-21T10:00:00+08:00',
            'type' => 'exception',
            'level' => 'error',
            'summary' => 'pretending to be a server event',
        ]],
    ])->assertStatus(422);
});

it('redacts client-submitted events too', function () {
    postJson(route('api.diagnostics.log.client-events'), [
        'events' => [[
            'occurredAt' => '2026-09-21T10:00:00+08:00',
            'type' => 'client.error',
            'level' => 'error',
            'summary' => 'failed for u1001',
            'context' => ['password' => 'hunter2'],
        ]],
    ])->assertSuccessful();

    $event = DiagnosticEvent::sole();

    expect($event->summary)->not->toContain('u1001')
        ->and(json_encode($event->context))->not->toContain('hunter2');
});

it('clears the log on request', function () {
    DiagnosticEvent::factory()->count(3)->create();

    deleteJson(route('api.diagnostics.log.clear'))->assertSuccessful();

    expect(DiagnosticEvent::count())->toBe(0);
});

it('serves the bundle as a downloadable markdown attachment', function () {
    DiagnosticEvent::factory()->upstream()->create(['summary' => 'GET uu.nou.edu.tw/xmlapi']);

    $response = get(route('api.diagnostics.log.bundle'));

    $response->assertSuccessful()
        ->assertHeader('Content-Type', 'text/markdown; charset=UTF-8');

    expect($response->headers->get('Content-Disposition'))
        ->toContain('attachment')
        ->toContain('alt-uu-diagnostics-');

    expect($response->getContent())
        ->toContain('# Alt UU 診斷記錄')
        ->toContain('GET uu.nou.edu.tw/xmlapi')
        ->toContain('事件記錄');
});

it('never puts a secret in the bundle', function () {
    DiagnosticEvent::factory()->create([
        'summary' => 'GET /api/courses',
        'context' => ['ticket' => 'SECRET-TICKET', 'username' => 'u1001'],
    ]);

    $content = get(route('api.diagnostics.log.bundle'))->getContent();

    expect($content)->not->toContain('SECRET-TICKET')
        ->and($content)->not->toContain('u1001');
});
