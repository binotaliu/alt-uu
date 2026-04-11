<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\Actions;

use App\Services\UUDiscussClient;

final readonly class LikePost
{
    public function __construct(private UUDiscussClient $discussClient) {}

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function __invoke(string $boardId, string $nodeId): array
    {
        // Like now hits mooc/controllers/forum_ajax.php (not xmlapi board-push-handler).
        return $this->discussClient->likePost($boardId, $nodeId);
    }
}
