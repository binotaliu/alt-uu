<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\Actions;

use App\Services\UUDiscussClient;

final readonly class UpdatePost
{
    public function __construct(private UUDiscussClient $discussClient) {}

    /**
     * @param  array<mixed>  $attaches
     * @return array{payload: array<string, mixed>}
     */
    public function __invoke(
        string $postId,
        ?string $subject = null,
        ?string $content = null,
        array $attaches = [],
    ): array {
        return $this->discussClient->updatePost($postId, $subject, $content, $attaches);
    }
}
