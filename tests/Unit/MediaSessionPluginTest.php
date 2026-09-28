<?php

use AltUU\AttachmentBridge\AttachmentBridge;

test('attachment bridge facade exports openTronclass method', function () {
    $bridge = new AttachmentBridge;

    expect(method_exists($bridge, 'openTronclass'))->toBeTrue();
});

test('attachment bridge openUrl supports method and postForm', function () {
    $bridge = new AttachmentBridge;

    $result = $bridge->openUrl(
        'https://example.com',
        [],
        'POST',
        ['foo' => 'bar'],
    );

    expect($result)->toBeNull();
});
