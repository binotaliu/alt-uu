<?php

declare(strict_types=1);

namespace AltUU\AttachmentBridge\Events;

use Illuminate\Foundation\Events\Dispatchable;

/**
 * Dispatched when `AttachmentBridge::pickDocument()` produced no file.
 * `$reason` is `cancelled` (user dismissed the picker), `too_large`
 * (over the requested `maxBytes`) or `failed` (copy/permission error).
 */
final class DocumentPickCancelled
{
    use Dispatchable;

    public function __construct(
        public ?string $id,
        public string $reason = 'cancelled',
    ) {}
}
