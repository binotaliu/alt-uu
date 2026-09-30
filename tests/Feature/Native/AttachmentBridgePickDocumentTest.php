<?php

declare(strict_types=1);

use AltUU\AttachmentBridge\Events\DocumentPickCancelled;
use AltUU\AttachmentBridge\Events\DocumentPicked;
use AltUU\AttachmentBridge\Facades\AttachmentBridge;
use Native\Mobile\Testing\Native;

it('queues the native picker and returns the correlation id', function (): void {
    $bridge = Native::fakeBridge()->respondTo('AttachmentBridge.PickDocument', ['status' => 'success', 'data' => ['queued' => true]]);

    $id = AttachmentBridge::pickDocument(['application/json'], 'req-1', 1024);

    $call = $bridge->callsTo('AttachmentBridge.PickDocument')[0]['params'];

    expect($id)->toBe('req-1')
        ->and($call)->toBe([
            'id' => 'req-1',
            'mimeTypes' => ['application/json'],
            'maxBytes' => 1024,
            'event' => DocumentPicked::class,
            'cancelledEvent' => DocumentPickCancelled::class,
        ]);
});

it('generates an id when none is given', function (): void {
    Native::fakeBridge()->respondTo('AttachmentBridge.PickDocument', ['status' => 'success', 'data' => ['queued' => true]]);

    expect(AttachmentBridge::pickDocument())->toMatch('/^[0-9a-f]{16}$/');
});

it('returns null when the bridge does not answer or refuses', function (?string $response): void {
    Native::fakeBridge()->respondTo('AttachmentBridge.PickDocument', $response);

    expect(AttachmentBridge::pickDocument(['application/json']))->toBeNull();
})->with([
    'no answer' => [null],
    'error' => ['{"status":"error","message":"no picker"}'],
]);

it('declares the picker function and its events in the plugin manifest', function (): void {
    $manifest = json_decode((string) file_get_contents(base_path('packages/altuu/plugin-attachment-bridge/nativephp.json')), true, flags: JSON_THROW_ON_ERROR);

    expect(collect($manifest['bridge_functions'])->pluck('name'))->toContain('AttachmentBridge.PickDocument')
        ->and($manifest['events'])->toBe([DocumentPicked::class, DocumentPickCancelled::class]);
});

it('builds the picked-document events from the native payload keys', function (): void {
    $picked = new DocumentPicked(...['id' => 'r', 'path' => '/tmp/a.json', 'name' => 'a.json', 'mimeType' => 'application/json', 'size' => 3]);
    $cancelled = new DocumentPickCancelled(...['id' => null, 'reason' => 'too_large']);

    expect($picked->path)->toBe('/tmp/a.json')->and($cancelled->reason)->toBe('too_large');
});
