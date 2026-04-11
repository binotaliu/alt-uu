<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Discuss\Actions\ListNodes;
use AltUU\Domains\Discuss\ViewModels\NodeListViewModel;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class DiscussNodeController
{
    public function index(
        Request $request,
        ListNodes $list,
    ): Response|NodeListViewModel {
        $courseId = (string) $request->query('cid');
        $boardId = (string) $request->query('bid');
        $keyword = (string) $request->query('keyword', '');

        if ($courseId === '' || $boardId === '') {
            return response(['error' => 'Course ID and Board ID are required'], 400);
        }

        return $list($courseId, $boardId, $keyword);
    }
}
