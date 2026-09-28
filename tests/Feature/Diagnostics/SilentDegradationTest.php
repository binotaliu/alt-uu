<?php

declare(strict_types=1);

use AltUU\Domains\Diagnostics\Enums\DiagnosticLevelEnum;
use App\Models\DiagnosticEvent;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;

use function Pest\Laravel\getJson;

beforeEach(function () {
    enableDiagnosticRecording();

    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => 'Test User', 'username' => 's1234567'],
    ]);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);
});

it('still serves an empty course list on an upstream 500, but no longer silently', function () {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response(
            '<html><body>Internal Server Error</body></html>',
            500,
        ),
        '*' => Http::response('<html><body></body></html>'),
    ]);

    // The contract does not change: UUProxyClient decodes the failed body to
    // [], ListCourses reads data.list off it, and the user still sees an
    // empty list rather than an error. That is the behaviour that made this
    // impossible to diagnose.
    getJson(route('api.courses.index'))
        ->assertSuccessful()
        ->assertExactJson([]);

    // What changed is that the reason is now written down.
    $upstream = DiagnosticEvent::query()
        ->where('level', DiagnosticLevelEnum::Error)
        ->where('status', 500)
        ->first();

    expect($upstream)->not->toBeNull()
        ->and($upstream->summary)->toContain('my-course-list')
        ->and($upstream->context['reason'])->toBe('upstream_status')
        ->and($upstream->context['bodySnippet'])->toContain('Internal Server Error');
});

it('flags a 200 carrying an unusable payload as a parse anomaly', function () {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response(
            '<html><body>login required</body></html>',
            200,
        ),
        '*' => Http::response('<html><body></body></html>'),
    ]);

    getJson(route('api.courses.index'))->assertSuccessful();

    $anomaly = DiagnosticEvent::query()
        ->where('type', 'parse.anomaly')
        ->first();

    expect($anomaly)->not->toBeNull()
        ->and($anomaly->status)->toBe(200)
        ->and($anomaly->context['reason'])->toBe('undecodable_json');
});

it('does not record a snippet when everything worked', function () {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'data' => ['list' => []],
        ]),
        '*' => Http::response('<html><body></body></html>'),
    ]);

    getJson(route('api.courses.index'))->assertSuccessful();

    expect(DiagnosticEvent::query()->where('level', DiagnosticLevelEnum::Error)->exists())
        ->toBeFalse();
});
