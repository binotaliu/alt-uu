<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\Actions;

use AltUU\Domains\Discuss\ViewModels\NodeListViewModel;
use AltUU\Domains\Discuss\ViewModels\NodeViewModel;
use App\Services\UUDiscussClient;
use Illuminate\Support\Arr;

final readonly class ListNodes
{
    public function __construct(private UUDiscussClient $discussClient) {}

    public function __invoke(string $courseId, string $boardId, string $keyword = ''): NodeListViewModel
    {
        $nodesResult = $this->discussClient->fetchBoardNodeList($boardId, $keyword);

        $nodesList = Arr::get($nodesResult['payload'], 'data.list', Arr::get($nodesResult['payload'], 'data', []));

        if (! is_array($nodesList)) {
            $nodesList = [];
        }

        $nodes = array_map(
            fn (array $node) => new NodeViewModel(
                node: (string) ($node['node'] ?? ''),
                subject: (string) ($node['subject'] ?? ''),
                isRead: (bool) $node['read'],
                poster: $node['realname'] ?? null,
                repliesCount: $node['reply'],
                likesCount: $node['push'] ?? null,
            ),
            $nodesList,
        );

        return new NodeListViewModel(
            courseId: $courseId,
            boardId: $boardId,
            nodes: array_values($nodes),
        );
    }
}
