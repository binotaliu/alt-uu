<?php

declare(strict_types=1);

use App\Services\UUSessionStore;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;

use function Pest\Laravel\getJson;

afterEach(function () {
    MockeryManager::close();
});

/**
 * @param  array<string, mixed>  $extraFakes
 */
function fakeMaterialInspection(array $extraFakes = []): void
{
    $session = MockeryManager::mock(UUSessionStore::class);
    $session->shouldReceive('get')->andReturn([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試使用者', 'username' => 'u1001'],
    ]);
    $session->shouldReceive('put');
    app()->instance(UUSessionStore::class, $session);

    Http::fake([
        ...$extraFakes,
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-path-info*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['path' => ['item' => [
                [
                    'identifier' => 'A1',
                    'text' => '第一章',
                    'href' => 'about:blank',
                    'item' => [
                        [
                            'identifier' => 'A2',
                            'text' => '1-1 課程簡介',
                            'href' => 'https://uu.nou.edu.tw/material/lesson-1.html?ticket=abc123&x=1',
                            'leaf' => true,
                        ],
                        [
                            'identifier' => 'A3',
                            'text' => '1-2 外部連結',
                            'href' => 'https://example.com/elsewhere.html',
                            'leaf' => true,
                        ],
                    ],
                ],
                [
                    'identifier' => 'B1',
                    'text' => '講義',
                    'href' => 'https://uu.nou.edu.tw/material/handout.pdf',
                    'leaf' => true,
                ],
            ]]],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=go-course*' => Http::response(['code' => 0]),
        'https://uu.nou.edu.tw/learn/path/pathtree.php' => Http::response('<html></html>'),
    ]);
}

it('lists every directory node with the url the school sent', function () {
    fakeMaterialInspection();

    $response = getJson(route('api.diagnostics.material.directory', ['cid' => '9001']));

    $response->assertSuccessful()
        ->assertJsonPath('nodeCount', 4)
        ->assertJsonPath('apiCode', 0)
        ->assertJsonPath('nodes.0.identifier', 'A1')
        ->assertJsonPath('nodes.0.level', 0)
        // The placeholder is reported as-is, not normalised away the way the
        // course directory does, and is not offered for inspection.
        ->assertJsonPath('nodes.0.href', 'about:blank')
        ->assertJsonPath('nodes.0.isInspectable', false)
        ->assertJsonPath('nodes.1.level', 1)
        ->assertJsonPath('nodes.1.isInspectable', true);
});

it('keeps credentials out of the directory urls and the raw json', function () {
    fakeMaterialInspection();

    $response = getJson(route('api.diagnostics.material.directory', ['cid' => '9001']));

    expect($response->json('nodes.1.href'))->toContain('lesson-1.html')->not->toContain('abc123')
        ->and($response->json('rawJson'))->toContain('lesson-1.html')->not->toContain('abc123')
        ->and($response->json('rawJsonTruncated'))->toBeFalse();
});

it('truncates an oversized directory payload', function () {
    config(['diagnostics.material_source_bytes' => 50]);
    fakeMaterialInspection();

    $response = getJson(route('api.diagnostics.material.directory', ['cid' => '9001']));

    expect($response->json('rawJsonTruncated'))->toBeTrue()
        ->and(strlen($response->json('rawJson')))->toBeLessThanOrEqual(50);
});

it('returns the raw source and a parse outcome for a node', function () {
    fakeMaterialInspection([
        'https://uu.nou.edu.tw/material/lesson-1.html*' => Http::response(
            '<html><head><meta name="viewport" content="width=device-width"></head>'
            .'<body><h2>第一章內容</h2><a href="/next?ticket=abc123">next</a></body></html>',
            200,
            ['Content-Type' => 'text/html; charset=utf-8'],
        ),
    ]);

    $response = getJson(route('api.diagnostics.material.source', ['cid' => '9001', 'scoid' => 'A2']));

    $response->assertSuccessful()
        ->assertJsonPath('fetchStatus', 200)
        ->assertJsonPath('isText', true)
        ->assertJsonPath('parse.succeeded', true)
        ->assertJsonPath('parse.kind', 'html')
        ->assertJsonPath('fetchError', null);

    // Source stays readable: structural attributes survive, credentials do not.
    expect($response->json('body'))->toContain('<meta name="viewport"')
        ->toContain('第一章內容')
        ->not->toContain('abc123')
        ->and($response->json('url'))->not->toContain('abc123');
});

it('reports an empty page as an empty parse rather than an error', function () {
    fakeMaterialInspection([
        'https://uu.nou.edu.tw/material/lesson-1.html*' => Http::response(
            '<html><body><div> </div></body></html>',
            200,
            ['Content-Type' => 'text/html'],
        ),
    ]);

    $response = getJson(route('api.diagnostics.material.source', ['cid' => '9001', 'scoid' => 'A2']));

    $response->assertSuccessful()
        ->assertJsonPath('fetchStatus', 200)
        ->assertJsonPath('parse.succeeded', true)
        ->assertJsonPath('parse.kind', 'empty')
        ->assertJsonPath('parse.htmlLength', 0);

    expect($response->json('body'))->toContain('<div>');
});

it('surfaces the failure when the school page cannot be fetched', function () {
    fakeMaterialInspection([
        'https://uu.nou.edu.tw/material/lesson-1.html*' => fn () => throw new ConnectionException('cURL error 28: timed out'),
    ]);

    $response = getJson(route('api.diagnostics.material.source', ['cid' => '9001', 'scoid' => 'A2']));

    $response->assertSuccessful()
        ->assertJsonPath('fetchStatus', null)
        ->assertJsonPath('body', null)
        ->assertJsonPath('parse.succeeded', false)
        ->assertJsonPath('parse.kind', 'error');

    expect($response->json('fetchError'))->toContain('ConnectionException')->toContain('timed out')
        ->and($response->json('parse.errorClass'))->toContain('ConnectionException')
        ->and($response->json('parse.errorLocation'))->toContain(':');
});

it('does not dump the bytes of a binary file', function () {
    fakeMaterialInspection([
        'https://uu.nou.edu.tw/material/handout.pdf*' => Http::response(
            '%PDF-1.4 binary',
            200,
            ['Content-Type' => 'application/pdf'],
        ),
    ]);

    $response = getJson(route('api.diagnostics.material.source', ['cid' => '9001', 'scoid' => 'B1']));

    $response->assertSuccessful()
        ->assertJsonPath('isText', false)
        ->assertJsonPath('body', null)
        ->assertJsonPath('bodyBytes', strlen('%PDF-1.4 binary'))
        ->assertJsonPath('parse.kind', 'download');
});

it('truncates an oversized source', function () {
    config(['diagnostics.material_source_bytes' => 40]);
    fakeMaterialInspection([
        'https://uu.nou.edu.tw/material/lesson-1.html*' => Http::response(
            '<html><body>'.str_repeat('內容', 100).'</body></html>',
            200,
            ['Content-Type' => 'text/html'],
        ),
    ]);

    $response = getJson(route('api.diagnostics.material.source', ['cid' => '9001', 'scoid' => 'A2']));

    expect($response->json('bodyTruncated'))->toBeTrue()
        ->and(strlen($response->json('body')))->toBeLessThanOrEqual(40)
        ->and(mb_check_encoding($response->json('body'), 'UTF-8'))->toBeTrue();
});

it('refuses nodes that point off the school host, have no link, or do not exist', function (string $scoid, int $status) {
    fakeMaterialInspection();

    getJson(route('api.diagnostics.material.source', ['cid' => '9001', 'scoid' => $scoid]))
        ->assertStatus($status);
})->with([
    'external host' => ['A3', 403],
    'placeholder link' => ['A1', 422],
    'unknown node' => ['ZZ9', 404],
]);
