<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Discuss\Actions\UnlikePost;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class UnlikeDiscussPostController
{
    /**
     * @return array<string, mixed>|Response
     */
    public function __invoke(UnlikePost $unlikePost, Request $request, string $nodeId): array|Response
    {
        $boardId = (string) $request->input('bid');

        if ($boardId === '' || $nodeId === '') {
            return response(['error' => 'bid and nodeId are required'], 400);
        }

        $result = $unlikePost($boardId, $nodeId);

        return $result['payload'];
    }
}
