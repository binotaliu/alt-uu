<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use App\NativeComponents\Support\MaterialDirectoryTree;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Traversable;

/**
 * Collapsible course material tree (MaterialDirectory.vue).
 *
 * Tag: `<native:material-directory key="material-directory" :cid="$cid" :material-nodes="$materialNodes" :learning-time-items="$learningTimeItems" :active-node-identifier="$scoid" :last-seen-identifier="$lastSeen->activityId" :last-seen-position-seconds="$lastSeen->positionSeconds" :last-seen-duration-seconds="$lastSeen->mediaDurationSeconds" :loading="$loading" select-mode="event" @node-selected="openNode" />`
 *
 * Props: `cid`, `materialNodes` (CourseMaterialNodeViewModel[], from
 * GetCoursePathInfo()['materialNodes']), `learningTimeItems`
 * (CourseLearningTimeItemViewModel[], from GetCourseLearningTimeItems; when
 * non-empty they replace `materialNodes` and add watch durations; pass
 * `->all()` of DataCollections), `activeNodeIdentifier`, `lastSeenIdentifier`,
 * `lastSeenPositionSeconds`, `lastSeenDurationSeconds`, `loading`,
 * `selectMode` (`event` default, or `link`). The component does not scroll:
 * place it inside the host screen's scroll view.
 *
 * Events: `node-selected` (`targetIdentifier`, `href|null`) in event mode. In
 * link mode the component navigates itself to `native.courses.material.show`
 * (`cid`, `scoid`) and emits nothing. Folders toggle locally; the ancestors of
 * the active node are expanded whenever the tree or the active node changes.
 */
final class MaterialDirectory extends NativeComponent
{
    public string $cid = '';

    /** @var array<int, mixed>|Traversable<int, mixed> */
    public array|Traversable $materialNodes = [];

    /** @var array<int, mixed>|Traversable<int, mixed> */
    public array|Traversable $learningTimeItems = [];

    public ?string $activeNodeIdentifier = null;

    public ?string $lastSeenIdentifier = null;

    public ?int $lastSeenPositionSeconds = null;

    public ?int $lastSeenDurationSeconds = null;

    public bool $loading = false;

    public string $selectMode = 'event';

    /** @var list<string> */
    public array $collapsed = [];

    private string $syncSignature = '';

    public function toggleDirectory(string $internalId): void
    {
        $this->collapsed = in_array($internalId, $this->collapsed, true)
            ? array_values(array_diff($this->collapsed, [$internalId]))
            : [...$this->collapsed, $internalId];
    }

    public function expandAll(): void
    {
        $this->collapsed = [];
    }

    public function collapseAll(): void
    {
        $this->collapsed = $this->directoryIds($this->displayNodes());
    }

    public function select(string $internalId): void
    {
        $node = collect($this->displayNodes())->firstWhere('internalId', $internalId);

        if ($node === null) {
            return;
        }

        if ($this->selectMode === 'link') {
            $this->navigate($this->route('native.courses.material.show', [
                'cid' => $this->cid,
                'scoid' => $node['targetIdentifier'],
            ]));

            return;
        }

        $this->emit('node-selected', $node['targetIdentifier'], $node['href']);
    }

    public function render(): View
    {
        $nodes = $this->displayNodes();
        $directoryIds = $this->directoryIds($nodes);
        $activeAncestors = MaterialDirectoryTree::activeAncestorIds($nodes, $this->activeNodeIdentifier);

        $signature = json_encode([$directoryIds, $activeAncestors]) ?: '';

        if ($signature !== $this->syncSignature) {
            $this->syncSignature = $signature;
            $this->collapsed = array_values(array_diff(
                array_intersect($this->collapsed, $directoryIds),
                $activeAncestors,
            ));
        }

        return view('native.shared.material-directory', [
            'nodes' => MaterialDirectoryTree::visible($nodes, $this->collapsed),
            'hasNodes' => $nodes !== [],
            'hasDirectories' => $directoryIds !== [],
            'allExpanded' => $this->collapsed === [],
            'allCollapsed' => $directoryIds !== [] && count($this->collapsed) === count($directoryIds),
            'activeAncestors' => $activeAncestors,
            'lastSeenLabel' => MaterialDirectoryTree::lastSeenLabel($this->lastSeenPositionSeconds, $this->lastSeenDurationSeconds),
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function displayNodes(): array
    {
        return MaterialDirectoryTree::build(
            MaterialDirectoryTree::sourceNodes($this->materialNodes, $this->learningTimeItems),
        );
    }

    /**
     * @param  list<array<string, mixed>>  $nodes
     * @return list<string>
     */
    private function directoryIds(array $nodes): array
    {
        return array_values(array_map(
            static fn (array $node): string => $node['internalId'],
            array_filter($nodes, static fn (array $node): bool => $node['isDirectory']),
        ));
    }
}
