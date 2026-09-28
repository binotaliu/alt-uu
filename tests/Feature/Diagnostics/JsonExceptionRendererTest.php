<?php

declare(strict_types=1);

use AltUU\Domains\Diagnostics\Enums\DiagnosticEventTypeEnum;
use App\Models\DiagnosticEvent;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Route;

use function Pest\Laravel\getJson;

beforeEach(function () {
    enableDiagnosticRecording();

    // Reproduce a shipped build: production, debug off. This is the
    // configuration in which Laravel throws the detail away.
    config()->set('app.debug', false);

    Route::get('/api/testing/boom', function () {
        throw new RuntimeException('Undefined array key "data" in course payload');
    });

    Route::get('/api/testing/forbidden', fn () => abort(403, '不允許存取外部資源'));
});

it('keeps the real exception detail even with debug off, where Laravel would say only "Server Error"', function () {
    $response = getJson('/api/testing/boom');

    $response->assertStatus(500)
        ->assertJsonPath('code', 'server_error')
        ->assertJsonPath('exception.class', RuntimeException::class)
        ->assertJsonPath('exception.message', 'Undefined array key "data" in course payload');

    expect($response->json('message'))->not->toBe('Server Error')
        ->and($response->json('exception.file'))->not->toStartWith('/')
        ->and($response->json('exception.trace'))->toBeArray()->not->toBeEmpty();
});

it('shows the user friendly copy rather than the raw php message', function () {
    getJson('/api/testing/boom')
        ->assertJsonPath('message', 'App 發生未預期的錯誤，請稍後再試。');
});

it('keeps an http exception message, which was written for the user', function () {
    getJson('/api/testing/forbidden')
        ->assertForbidden()
        ->assertJsonPath('message', '不允許存取外部資源')
        ->assertJsonPath('code', 'http_error');
});

it('can be switched off, falling back to laravel defaults', function () {
    config()->set('diagnostics.expose_exceptions', false);

    getJson('/api/testing/boom')
        ->assertStatus(500)
        ->assertJsonMissingPath('exception');
});

it('echoes the correlation id the client supplied', function () {
    $response = getJson('/api/testing/boom', ['X-Request-Id' => 'abc12345']);

    $response->assertHeader('X-Request-Id', 'abc12345')
        ->assertJsonPath('requestId', 'abc12345');
});

it('rejects a malformed correlation id rather than logging arbitrary text', function () {
    $response = getJson('/api/testing/boom', ['X-Request-Id' => "evil\ninjected line"]);

    expect($response->headers->get('X-Request-Id'))->toMatch('/^[a-f0-9]{8}$/');
});

it('generates a distinct id for each request, so concurrent calls stay apart', function () {
    Route::get('/api/testing/ok', fn () => response()->json(['ok' => true]));

    $ids = collect(range(1, 25))
        ->map(fn (): ?string => getJson('/api/testing/ok')->headers->get('X-Request-Id'))
        ->all();

    expect(array_unique($ids))->toHaveCount(25);
});

it('records the failing request and the exception against the same id', function () {
    getJson('/api/testing/boom', ['X-Request-Id' => 'abc12345', 'X-Alt-UU-Op' => 'courses.list']);

    $request = DiagnosticEvent::where('type', DiagnosticEventTypeEnum::ApiRequest)->sole();
    $exception = DiagnosticEvent::where('type', DiagnosticEventTypeEnum::Exception)->sole();

    expect($request->request_id)->toBe('abc12345')
        ->and($request->op)->toBe('courses.list')
        ->and($request->status)->toBe(500)
        ->and($request->summary)->toBe('GET /api/testing/boom')
        ->and($exception->request_id)->toBe('abc12345')
        ->and($exception->summary)->toContain('RuntimeException');
});

it('still returns the 503 contract for an upstream connection failure', function () {
    Route::get('/api/testing/offline', function () {
        throw new ConnectionException('cURL error 28');
    });

    getJson('/api/testing/offline')
        ->assertStatus(503)
        ->assertJsonPath('code', 'external_service_unavailable')
        ->assertJsonPath('message', '外部服務暫時無法連線，請稍後再試。');
});
