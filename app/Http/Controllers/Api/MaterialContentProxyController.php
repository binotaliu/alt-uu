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
    /**
     * Sent by patched native shells that can fetch and stream upstream content themselves.
     */
    public const NATIVE_FETCH_SUPPORTED_HEADER = 'X-Native-Fetch-Supported';

    /**
     * Base64-encoded JSON {url, headers} telling the native shell what to fetch.
     */
    public const NATIVE_FETCH_HEADER = 'X-Native-Fetch';

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

        if ($this->shouldHandOffToNative($request)) {
            $handoff = json_encode($proxyClient->materialFetchHandoff($url), JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

            return response('', 200)->header(self::NATIVE_FETCH_HEADER, base64_encode($handoff));
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

    private function shouldHandOffToNative(Request $request): bool
    {
        return $request->header(self::NATIVE_FETCH_SUPPORTED_HEADER) === '1'
            && (bool) config('hungu.material_proxy_native_fetch', true);
    }
}
