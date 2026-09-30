<?php

declare(strict_types=1);

namespace App\NativeComponents\Support;

/**
 * Port of resources/js/lib/attachmentImage.ts: attachments carry no MIME type,
 * so image detection is by extension of the filename, then of the URL path.
 */
final class AttachmentKind
{
    private const array IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif', 'avif'];

    public static function isImage(?string $filename, ?string $href = null): bool
    {
        $extension = ($filename !== null && $filename !== '' ? self::extension($filename) : null)
            ?? ($href !== null && $href !== '' ? self::extension($href) : null);

        return $extension !== null && in_array($extension, self::IMAGE_EXTENSIONS, true);
    }

    private static function extension(string $value): ?string
    {
        $withoutQuery = preg_split('/[?#]/', $value, 2)[0] ?? $value;

        return preg_match('/\.([a-z0-9]+)$/i', $withoutQuery, $matches) === 1 ? strtolower($matches[1]) : null;
    }
}
