<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\Actions;

use App\Services\UUDiscussClient;

final readonly class SetForumRead
{
    public function __construct(private UUDiscussClient $discussClient) {}

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function __invoke(string $postId): array
    {
        return $this->discussClient->setForumRead($postId);
    }
}
