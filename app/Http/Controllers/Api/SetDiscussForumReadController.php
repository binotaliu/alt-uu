<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Discuss\Actions\SetForumRead;
use Symfony\Component\HttpFoundation\Response;

final class SetDiscussForumReadController
{
    /**
     * @return array<string, mixed>|Response
     */
    public function __invoke(SetForumRead $setForumRead, string $postId): array|Response
    {
        if ($postId === '') {
            return response(['error' => 'postId is required'], 400);
        }

        $result = $setForumRead($postId);

        return $result['payload'];
    }
}
