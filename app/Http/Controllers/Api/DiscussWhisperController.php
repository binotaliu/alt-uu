<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Discuss\Actions\CreateWhisper;
use AltUU\Domains\Discuss\Actions\DeleteWhisper;
use AltUU\Domains\Discuss\Actions\UpdateWhisper;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class DiscussWhisperController
{
    /**
     * @return array<string, mixed>|Response
     */
    public function store(Request $request, CreateWhisper $createWhisper): array|Response
    {
        $boardId = (string) $request->input('bid');
        $nodeId = (string) $request->input('nid');
        $content = (string) $request->input('content');

        if ($boardId === '' || $nodeId === '' || $content === '') {
            return response(['error' => 'bid, nid and content are required'], 400);
        }

        $result = $createWhisper($boardId, $nodeId, $content);

        return $result['payload'];
    }

    /**
     * @return array<string, mixed>|Response
     */
    public function update(Request $request, UpdateWhisper $updateWhisper, string $whisperId): array|Response
    {
        $boardId = (string) $request->input('bid');
        $nodeId = (string) $request->input('nid');
        $content = (string) $request->input('content');

        if ($boardId === '' || $nodeId === '' || $whisperId === '' || $content === '') {
            return response(['error' => 'bid, nid, wid and content are required'], 400);
        }

        $result = $updateWhisper($boardId, $nodeId, $whisperId, $content);

        return $result['payload'];
    }

    /**
     * @return array<string, mixed>|Response
     */
    public function destroy(Request $request, DeleteWhisper $deleteWhisper, string $whisperId): array|Response
    {
        $boardId = (string) $request->input('bid');
        $nodeId = (string) $request->input('nid');

        if ($boardId === '' || $nodeId === '' || $whisperId === '') {
            return response(['error' => 'bid, nid and wid are required'], 400);
        }

        $result = $deleteWhisper($boardId, $nodeId, $whisperId);

        return $result['payload'];
    }
}
