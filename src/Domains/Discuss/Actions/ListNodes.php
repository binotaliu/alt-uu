<?php

declare(strict_types=1);

namespace AltUU\Domains\Discuss\Actions;

use AltUU\Domains\Discuss\ViewModels\NodeListViewModel;
use AltUU\Domains\Discuss\ViewModels\NodeViewModel;
use App\Models\BlockedContent;
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

        $nodeIds = array_filter(array_map(
            fn (array $node) => (string) ($node['node'] ?? ''),
            $nodesList,
        ));

        $blockedMap = $this->getBlockedMap($boardId, $nodeIds);

        $nodes = array_map(
            function (array $node) use ($blockedMap): NodeViewModel {
                $nodeId = (string) ($node['node'] ?? '');
                $blockedReason = $blockedMap[$nodeId] ?? null;

                return new NodeViewModel(
                    node: $nodeId,
                    subject: (string) ($node['subject'] ?? ''),
                    isRead: (bool) $node['read'],
                    poster: $node['realname'] ?? null,
                    repliesCount: $node['reply'],
                    likesCount: $node['push'] ?? null,
                    isBlocked: $blockedReason !== null,
                    blockedReason: $blockedReason,
                );
            },
            $nodesList,
        );

        return new NodeListViewModel(
            courseId: $courseId,
            boardId: $boardId,
            nodes: array_values($nodes),
        );
    }

    /**
     * @param  string[]  $nodeIds
     * @return array<string, string> nodeId → reason
     */
    private function getBlockedMap(string $boardId, array $nodeIds): array
    {
        if ($nodeIds === []) {
            return [];
        }

        $boardHash = hash('sha256', $boardId);
        $nodeHashMap = [];

        foreach ($nodeIds as $nodeId) {
            $nodeHashMap[hash('sha256', $nodeId)] = $nodeId;
        }

        $blocked = BlockedContent::where('board_hash', $boardHash)
            ->whereIn('node_hash', array_keys($nodeHashMap))
            ->get();

        $map = [];

        foreach ($blocked as $item) {
            $map[$nodeHashMap[$item->node_hash]] = $item->reason;
        }

        return $map;
    }
}
