<?php

declare(strict_types=1);

namespace AltUU\AttachmentBridge;

final class AttachmentBridge
{
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
