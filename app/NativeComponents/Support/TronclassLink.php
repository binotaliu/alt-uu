<?php

declare(strict_types=1);

namespace App\NativeComponents\Support;

use AltUU\AttachmentBridge\Facades\AttachmentBridge;
use Native\Mobile\Facades\Browser;

/**
 * Opens a tronclass URL in the tronclass app (`tronclass://navigate?url=…`, the
 * Vue behaviour) and falls back to the in-app browser when the app or the
 * bridge is unavailable.
 */
final class TronclassLink
{
    /**
     * The custom-scheme URL the tronclass app is opened with.
     */
    public static function target(string $url): string
    {
        return 'tronclass://navigate?url='.rawurlencode($url);
    }

    public static function open(string $url): void
    {
        if (AttachmentBridge::openTronclass(self::target($url)) === null) {
            Browser::inApp($url);
        }
    }
}
