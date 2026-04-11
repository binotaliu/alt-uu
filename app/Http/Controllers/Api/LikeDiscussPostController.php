<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Discuss\Actions\LikePost;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class LikeDiscussPostController
{
    /**
     * @return array<string, mixed>|Response
     */
    public function __invoke(LikePost $likePost, Request $request, string $nodeId): array|Response
    {
        $boardId = (string) $request->input('bid');

        if ($boardId === '' || $nodeId === '') {
            return response(['error' => 'bid and nodeId are required'], 400);
        }

        $result = $likePost($boardId, $nodeId);

        return $result['payload'];
    }
}
