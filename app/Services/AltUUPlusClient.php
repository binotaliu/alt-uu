<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

final class AltUUPlusClient
{
    private readonly string $baseUrl;

    public function __construct()
    {
        $this->baseUrl = (string) config('services.iap.base_url', 'https://alt-uu.binota.org');
    }

    /**
     * Both calls return null whenever the backend can't give a definitive answer (offline, timeout,
     * non-2xx); callers must treat that as "unknown", never as "not subscribed".
     *
     * @param  array<string, mixed>  $reference
     * @return array<string, mixed>|null
     */
    public function verify(string $platform, array $reference): ?array
    {
        try {
            $response = Http::asJson()
                ->timeout((int) config('services.iap.timeout', 10))
                ->post($this->baseUrl.'/api/iap/verify', [
                    'platform' => $platform,
                    ...$reference,
                ]);
        } catch (ConnectionException) {
            return null;
        }

        return $response->successful() ? $response->json() : null;
    }

    /**
     * @param  array<string, mixed>  $reference
     * @return array<string, mixed>|null
     */
    public function entitlement(string $platform, array $reference): ?array
    {
        try {
            $response = Http::timeout((int) config('services.iap.timeout', 10))
                ->get($this->baseUrl.'/api/iap/entitlement', [
                    'platform' => $platform,
                    ...$reference,
                ]);
        } catch (ConnectionException) {
            return null;
        }

        return $response->successful() ? $response->json() : null;
    }
}
