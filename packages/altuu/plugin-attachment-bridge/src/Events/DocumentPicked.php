<?php

declare(strict_types=1);

namespace AltUU\AttachmentBridge\Events;

use Illuminate\Foundation\Events\Dispatchable;

/**
 * Dispatched from native code once the user picked a document with
 * `AttachmentBridge::pickDocument()`. The file was already copied into the
 * app's cache/temp storage, so `$path` is readable by PHP and owned by the
 * app (delete it after use). Payload keys map to the constructor arguments.
 */
final class DocumentPicked
{
    use Dispatchable;

    public function __construct(
        public ?string $id,
        public string $path,
        public string $name,
        public string $mimeType,
        public int $size,
    ) {}
}
