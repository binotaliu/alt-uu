<?php

declare(strict_types=1);

use AltUU\Domains\Diagnostics\Checks\HttpReachabilityProbe;
use AltUU\Domains\Diagnostics\Enums\ConnectivityServiceEnum;
use AltUU\Domains\Diagnostics\Enums\DiagnosticEventTypeEnum;
use AltUU\Domains\Diagnostics\Enums\DiagnosticLevelEnum;
use App\Models\DiagnosticEvent;
use App\Services\Diagnostics\UpstreamCallSubscriber;
use GuzzleHttp\Psr7\Request as GuzzleRequest;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Events\ConnectionFailed;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    enableDiagnosticRecording();
});

it('records a successful upstream call as an informational event', function () {
    Http::fake(['*' => Http::response(['data' => ['list' => []]], 200)]);

    Http::get('https://uu.nou.edu.tw/xmlapi/index.php?action=getCourseList');

    $event = DiagnosticEvent::sole();

    expect($event->type)->toBe(DiagnosticEventTypeEnum::UpstreamCall)
        ->and($event->level)->toBe(DiagnosticLevelEnum::Info)
        ->and($event->status)->toBe(200)
        ->and($event->context['host'])->toBe('uu.nou.edu.tw')
        ->and($event->context)->not->toHaveKey('bodySnippet');
});

it('records an upstream 500 as an error carrying a body snippet', function () {
    Http::fake(['*' => Http::response('<html><body>Internal Server Error</body></html>', 500)]);

    Http::get('https://uu.nou.edu.tw/xmlapi/index.php?action=getCourseList');

    $event = DiagnosticEvent::sole();

    expect($event->level)->toBe(DiagnosticLevelEnum::Error)
        ->and($event->status)->toBe(500)
        ->and($event->context['reason'])->toBe('upstream_status')
        ->and($event->context['bodySnippet'])->toContain('Internal Server Error');
});

it('flags a 200 whose body will not decode as a parse anomaly', function () {
    Http::fake(['*' => Http::response('<html>login page</html>', 200)]);

    Http::get('https://uu.nou.edu.tw/xmlapi/index.php?action=getCourseList');

    $event = DiagnosticEvent::sole();

    expect($event->type)->toBe(DiagnosticEventTypeEnum::ParseAnomaly)
        ->and($event->level)->toBe(DiagnosticLevelEnum::Warning)
        ->and($event->status)->toBe(200)
        ->and($event->context['reason'])->toBe('undecodable_json')
        ->and($event->context['bodySnippet'])->toContain('login page');
});

it('does not flag an HTML body as a parse anomaly when the caller expects raw content', function () {
    Http::fake(['*' => Http::response('<html>my forum</html>', 200)]);

    Http::acceptJson()
        ->withAttributes([UpstreamCallSubscriber::EXPECTS_JSON_ATTRIBUTE => false])
        ->get('https://uu.nou.edu.tw/learn/my_forum.php');

    $event = DiagnosticEvent::sole();

    expect($event->type)->toBe(DiagnosticEventTypeEnum::UpstreamCall)
        ->and($event->level)->toBe(DiagnosticLevelEnum::Info);
});

// Http::fake() with a closure that throws goes straight past Laravel's
// marshalConnectionException(), so no ConnectionFailed event is dispatched.
// A real offline device does dispatch it, so drive the listener with the
// event Guzzle would actually produce.
it('records a connection failure with the underlying reason', function () {
    event(new ConnectionFailed(
        new Request(new GuzzleRequest('GET', 'https://uu.nou.edu.tw/xmlapi/index.php')),
        new ConnectionException('cURL error 28: Connection timed out'),
    ));

    $event = DiagnosticEvent::sole();

    expect($event->level)->toBe(DiagnosticLevelEnum::Error)
        ->and($event->status)->toBeNull()
        ->and($event->summary)->toContain('uu.nou.edu.tw/xmlapi/index.php')
        ->and($event->context['reason'])->toBe('connection_failed')
        ->and($event->context['detail'])->toContain('Connection timed out');
});

it('strips the ticket from the recorded url', function () {
    Http::fake(['*' => Http::response([], 200)]);

    Http::get('https://uu.nou.edu.tw/xmlapi/index.php?action=getCourseList&ticket=SECRET123&ua=Mozilla');

    $event = DiagnosticEvent::sole();

    expect($event->summary)->not->toContain('SECRET123')
        ->and($event->summary)->toContain('action=getCourseList')
        ->and($event->summary)->toStartWith('GET https://uu.nou.edu.tw/xmlapi/index.php');
});

it('measures how long the upstream call took', function () {
    Http::fake(['*' => Http::response([], 200)]);

    Http::get('https://uu.nou.edu.tw/xmlapi/index.php');

    expect(DiagnosticEvent::sole()->duration_ms)->toBeInt()->toBeGreaterThanOrEqual(0);
});

it('does not record the connectivity probes, whose failures are the result itself', function () {
    Http::fake(['*' => Http::response('', 500)]);

    app(HttpReachabilityProbe::class)
        ->check(ConnectivityServiceEnum::Hungu, 'https://uu.nou.edu.tw', 5);

    expect(DiagnosticEvent::count())->toBe(0);
});
