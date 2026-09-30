<?php

declare(strict_types=1);

namespace AltUU\AttachmentBridge;

use AltUU\AttachmentBridge\Events\DocumentPickCancelled;
use AltUU\AttachmentBridge\Events\DocumentPicked;

final class AttachmentBridge
{
    public const int DEFAULT_MAX_PICK_BYTES = 10_485_760;

    public function download(string $url, ?string $filename = null): ?object
    {
        return $this->call('AttachmentBridge.Download', [
            'url' => $url,
            'filename' => $filename,
        ]);
    }

    public function openUrl(string $url, array $cookies = [], string $method = 'GET', array $postForm = [], ?string $css = null): ?object
    {
        return $this->call('AttachmentBridge.OpenURL', [
            'url' => $url,
            'cookies' => $cookies,
            'method' => strtoupper($method),
            'postForm' => $postForm,
            'css' => $css,
        ]);
    }

    public function openTronclass(string $url): ?object
    {
        return $this->call('AttachmentBridge.OpenTronclass', [
            'url' => $url,
        ]);
    }

    /**
     * Opens the system document picker (UIDocumentPickerViewController /
     * Storage Access Framework). The result arrives asynchronously as
     * `DocumentPicked` (file copied into app storage) or `DocumentPickCancelled`,
     * both carrying the returned correlation id:
     *
     *     $id = AttachmentBridge::pickDocument(['application/json']);
     *     // #[On(DocumentPicked::class)] public function picked(?string $id, string $path, ...)
     *
     * Returns null when no picker is available (not running on a device, or
     * the native call failed), so callers can fall back to another input.
     *
     * @param  list<string>  $mimeTypes  allowed MIME types, empty for any file
     */
    public function pickDocument(array $mimeTypes = [], ?string $id = null, int $maxBytes = self::DEFAULT_MAX_PICK_BYTES): ?string
    {
        $id ??= bin2hex(random_bytes(8));

        $result = $this->call('AttachmentBridge.PickDocument', [
            'id' => $id,
            'mimeTypes' => array_values($mimeTypes),
            'maxBytes' => $maxBytes,
            'event' => DocumentPicked::class,
            'cancelledEvent' => DocumentPickCancelled::class,
        ]);

        return ($result->queued ?? false) === true ? $id : null;
    }

    private function call(string $method, array $parameters = []): ?object
    {
        if (! function_exists('nativephp_call')) {
            return null;
        }

        $result = nativephp_call($method, json_encode($parameters));

        if (! $result) {
            return null;
        }

        $decoded = json_decode($result);

        return $decoded->data ?? null;
    }
}
