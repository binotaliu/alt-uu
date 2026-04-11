<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\Actions;

use AltUU\Domains\Discuss\ViewModels\BoardListViewModel;
use AltUU\Domains\Discuss\ViewModels\BoardViewModel;
use App\Services\UUDiscussClient;
use Illuminate\Support\Arr;

final readonly class ListBoards
{
    public function __construct(private UUDiscussClient $discussClient) {}

    public function __invoke(string $courseId): BoardListViewModel
    {
        $boardResult = $this->discussClient->fetchBoardList($courseId);

        $boardsList = Arr::get($boardResult['payload'], 'data.list', Arr::get($boardResult['payload'], 'data', []));

        if (! is_array($boardsList)) {
            $boardsList = [];
        }

        $boards = array_map(
            fn (array $board) => new BoardViewModel(
                boardId: (string) ($board['board_id'] ?? ''),
                boardName: (string) ($board['board_name'] ?? $board['title'] ?? ''),
                allowPost: isset($board['is_bulletin']) ? ! ((bool) $board['is_bulletin']) : false,
                hasNewPost: isset($board['read_flag']) ? ! ((bool) $board['read_flag']) : false,
                subjectCount: isset($board['subject_cnt']) ? (int) $board['subject_cnt'] : null,
            ),
            $boardsList,
        );

        return new BoardListViewModel(
            courseId: $courseId,
            boards: array_values($boards),
        );
    }
}
