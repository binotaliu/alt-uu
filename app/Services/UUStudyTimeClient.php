<?php

declare(strict_types=1);

namespace App\Services;

final class UUStudyTimeClient
{
    public function __construct(private readonly UUProxyClient $proxyClient) {}

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function fetchServerTime(): array
    {
        return $this->proxyClient->request('get-server-time', 'GET');
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{payload: array<string, mixed>}
     */
    public function recordStudyTime(array $payload): array
    {
        return $this->proxyClient->request('set-read-node-history', 'POST', [], $payload);
    }
}
