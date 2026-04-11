<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\Actions;

use App\Services\UUDiscussClient;

final readonly class UpdateWhisper
{
    public function __construct(private UUDiscussClient $discussClient) {}

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function __invoke(string $boardId, string $nodeId, string $whisperId, string $content): array
    {
        return $this->discussClient->updateWhisper($boardId, $nodeId, $whisperId, nl2br(htmlspecialchars($content)));
    }
}
