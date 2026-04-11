<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use AltUU\Domains\Course\Support\MaterialProxyUrl;
use App\Services\UUProxyClient;
use Illuminate\Http\Request;
use Native\Mobile\Facades\Device;

final class MaterialContentProxyController
{
    public function __invoke(
        Request $request,
        UUProxyClient $proxyClient,
        SyncCurrentCourse $syncCourse,
        string $encodedUrl,
    ) {
        if ($request->input('cid') !== null) {
            $syncCourse(
                request: $request,
                cid: $request->input('cid'),
                force: true,
            );
        }

        $url = MaterialProxyUrl::decode($encodedUrl);

        if (! is_string($url) || ! filter_var($url, FILTER_VALIDATE_URL)) {
            abort(400, '無效的資源 URL');
        }

        $session = $request->hunguSession();
        $baseHost = parse_url((string) ($session['base_url'] ?? ''), PHP_URL_HOST);
        $urlHost = parse_url($url, PHP_URL_HOST);

        if (! is_string($baseHost) || ! is_string($urlHost) || $baseHost !== $urlHost) {
            abort(403, '不允許存取外部資源');
        }

        $material = $proxyClient->fetchMaterialContent($url);

        $body = $material['body'] ?? '';
        $headers = $material['headers'] ?? [];
        $status = $material['status'] ?? 200;

        $contentType = strtolower((string) ($headers['content-type'] ?? ''));
        $isTextContent = str_starts_with($contentType, 'text/')
            || str_contains($contentType, 'application/json')
            || str_contains($contentType, 'application/javascript')
            || str_contains($contentType, 'application/xml');

        $isInNativePHP = ! empty(Device::getInfo());

        if (! $isTextContent && $body !== '' && $isInNativePHP) {
            $body = base64_encode($body);
            $headers['X-Body-Encoding'] = 'base64';
        }

        return response($body, $status)->withHeaders($headers);
    }
}
