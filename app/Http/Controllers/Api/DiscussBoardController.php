<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Discuss\Actions\ListBoards;
use AltUU\Domains\Discuss\ViewModels\BoardListViewModel;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class DiscussBoardController
{
    public function index(
        Request $request,
        ListBoards $list,
    ): Response|BoardListViewModel {
        $courseId = (string) $request->query('cid');

        if ($courseId === '') {
            return response(['error' => 'Course ID is required'], 400);
        }

        return $list($courseId);
    }
}
