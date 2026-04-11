<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\Actions;

use App\Services\UUDiscussClient;

final readonly class DeleteWhisper
{
    public function __construct(private UUDiscussClient $discussClient) {}

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function __invoke(string $boardId, string $nodeId, string $whisperId): array
    {
        return $this->discussClient->deleteWhisper($boardId, $nodeId, $whisperId);
    }
}
