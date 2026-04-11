<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\Actions;

use App\Services\UUDiscussClient;

final readonly class CreateWhisper
{
    public function __construct(private UUDiscussClient $discussClient) {}

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function __invoke(string $boardId, string $nodeId, string $content): array
    {
        return $this->discussClient->createWhisper($boardId, $nodeId, nl2br(htmlspecialchars($content)));
    }
}
