<?php

declare(strict_types=1);

use AltUU\Domains\Diagnostics\Enums\DiagnosticEventTypeEnum;
use AltUU\Domains\Diagnostics\Enums\DiagnosticLevelEnum;
use App\Models\DiagnosticEvent;
use App\Services\Diagnostics\DiagnosticRecorder;
use App\Services\Diagnostics\DiagnosticRedactor;

beforeEach(function () {
    enableDiagnosticRecording();
});

it('records an event', function () {
    app(DiagnosticRecorder::class)->record(
        DiagnosticEventTypeEnum::ApiRequest,
        'GET /api/courses',
        DiagnosticLevelEnum::Info,
        status: 200,
        durationMs: 120,
        op: 'courses.list',
        requestId: 'a3f91c02',
    );

    $event = DiagnosticEvent::sole();

    expect($event->type)->toBe(DiagnosticEventTypeEnum::ApiRequest)
        ->and($event->op)->toBe('courses.list')
        ->and($event->request_id)->toBe('a3f91c02')
        ->and($event->status)->toBe(200)
        ->and($event->duration_ms)->toBe(120);
});

it('redacts on write so the stored row never holds a secret', function () {
    app(DiagnosticRecorder::class)->record(
        DiagnosticEventTypeEnum::UpstreamCall,
        'GET uu.nou.edu.tw',
        DiagnosticLevelEnum::Error,
        context: [
            'ticket' => 'SECRET-TICKET-123',
            'profile' => ['username' => 'u1001'],
        ],
    );

    $event = DiagnosticEvent::sole();
    $stored = json_encode($event->getAttributes(), JSON_THROW_ON_ERROR);

    expect($stored)->not->toContain('SECRET-TICKET-123')
        ->and($stored)->not->toContain('u1001')
        ->and($event->context['ticket'])->toBe(DiagnosticRedactor::REDACTED)
        ->and($event->context['profile']['username'])->toStartWith('user#');
});

it('keeps the log bounded to max_events, discarding the oldest first', function () {
    config()->set('diagnostics.max_events', 5);

    foreach (range(1, 12) as $i) {
        app(DiagnosticRecorder::class)->record(
            DiagnosticEventTypeEnum::ApiRequest,
            "request {$i}",
        );
    }

    expect(DiagnosticEvent::count())->toBe(5)
        ->and(DiagnosticEvent::orderBy('id')->first()->summary)->toBe('request 8')
        ->and(DiagnosticEvent::orderByDesc('id')->first()->summary)->toBe('request 12');
});

it('writes nothing when the build ships without diagnostics', function () {
    config()->set('diagnostics.enabled', false);
    // beforeEach already opened a window and the recorder memoizes that for
    // the request, so take a fresh one to see the build switch.
    app()->forgetInstance(DiagnosticRecorder::class);

    $recorder = app(DiagnosticRecorder::class);
    $recorder->record(DiagnosticEventTypeEnum::ApiRequest, 'ignored');

    expect(DiagnosticEvent::count())->toBe(0)
        ->and($recorder->isEnabled())->toBeFalse()
        ->and($recorder->setRecording(true))->toBeNull();
});

it('does not record until the user opens a recording window', function () {
    app(DiagnosticRecorder::class)->setRecording(false);
    app()->forgetInstance(DiagnosticRecorder::class);

    app(DiagnosticRecorder::class)->record(DiagnosticEventTypeEnum::ApiRequest, 'ignored');

    expect(DiagnosticEvent::count())->toBe(0);
});

it('stops recording once the window has elapsed', function () {
    $recorder = app(DiagnosticRecorder::class);
    config()->set('diagnostics.recording_window_minutes', 30);
    $recorder->setRecording(true);

    expect($recorder->isEnabled())->toBeTrue();

    // The window is enforced against the clock, so nothing has to run on a
    // timer to close it — which matters, since no scheduler runs on a device.
    $this->travel(31)->minutes();
    app()->forgetInstance(DiagnosticRecorder::class);

    $later = app(DiagnosticRecorder::class);
    $later->record(DiagnosticEventTypeEnum::ApiRequest, 'after the window');

    expect($later->isEnabled())->toBeFalse()
        ->and($later->recordingExpiresAt())->toBeNull()
        ->and(DiagnosticEvent::where('summary', 'after the window')->exists())->toBeFalse();
});

it('discards rows past the retention age', function () {
    config()->set('diagnostics.retention_days', 14);

    $old = DiagnosticEvent::factory()->create([
        'occurred_at' => now()->subDays(20),
        'summary' => 'ancient',
    ]);
    DiagnosticEvent::factory()->create([
        'occurred_at' => now()->subDays(3),
        'summary' => 'recent',
    ]);

    app(DiagnosticRecorder::class)->pruneExpired();

    expect(DiagnosticEvent::find($old->id))->toBeNull()
        ->and(DiagnosticEvent::where('summary', 'recent')->exists())->toBeTrue();
});

it('prunes aged rows when a new recording window opens', function () {
    config()->set('diagnostics.retention_days', 14);
    DiagnosticEvent::factory()->create(['occurred_at' => now()->subDays(30)]);

    app(DiagnosticRecorder::class)->setRecording(true);

    expect(DiagnosticEvent::count())->toBe(0);
});

it('truncates an oversized body snippet after redacting it', function () {
    config()->set('diagnostics.body_snippet_bytes', 32);

    $snippet = app(DiagnosticRecorder::class)->snippet(
        'ticket=SECRET123&'.str_repeat('x', 500),
    );

    expect($snippet)->not->toContain('SECRET123')
        ->and($snippet)->toEndWith('…（已截斷）')
        ->and(mb_strlen($snippet))->toBeLessThan(60);
});

it('never lets a recording failure break the caller', function () {
    Schema::drop('diagnostic_events');

    expect(fn () => app(DiagnosticRecorder::class)->record(
        DiagnosticEventTypeEnum::ApiRequest,
        'table is gone',
    ))->not->toThrow(Exception::class);
});

it('masks a query-string credential in a body snippet', function () {
    // A failed upstream body is free text whose links carry the school's own
    // ticket, which the assignment sweep alone would miss.
    $snippet = app(DiagnosticRecorder::class)
        ->snippet('redirect: https://uu.nou.edu.tw/login?token=s3cr3t&next=/learn');

    expect($snippet)->toContain('next=/learn')->not->toContain('s3cr3t');
});
