<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\Actions;

use App\Services\UUDiscussClient;

final readonly class CreatePost
{
    public function __construct(private UUDiscussClient $discussClient) {}

    /**
     * @param  array<mixed>  $attaches
     * @return array{payload: array<string, mixed>}
     */
    public function __invoke(
        string $boardId,
        string $subject,
        string $content,
        ?string $replyContent = null,
        ?string $replyPostId = null,
        array $attaches = [],
    ): array {
        return $this->discussClient->createPost(
            $boardId,
            $subject,
            nl2br(htmlspecialchars($content)),
            $replyContent,
            $replyPostId,
            $attaches,
        );
    }
}
