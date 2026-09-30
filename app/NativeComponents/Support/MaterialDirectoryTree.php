<?php

declare(strict_types=1);

namespace App\NativeComponents\Support;

use AltUU\Domains\Course\ViewModels\CourseLearningTimeItemViewModel;
use AltUU\Domains\Course\ViewModels\CourseMaterialNodeViewModel;

/**
 * Pure tree logic of MaterialDirectory.vue: turns the flat, level-indented
 * node list into display nodes with ancestors, folders and synthetic links.
 *
 * @phpstan-type DisplayNode array{
 *     identifier: string,
 *     href: string|null,
 *     text: string,
 *     level: int,
 *     itemDisabled: bool,
 *     duration: string|null,
 *     internalId: string,
 *     targetIdentifier: string,
 *     isDirectory: bool,
 *     isSyntheticLink: bool,
 *     ancestorDirectoryIds: list<string>,
 *     parentInternalId: string|null
 * }
 */
final class MaterialDirectoryTree
{
    /**
     * Learning-time items (they carry watch durations) win over plain
     * material nodes when there are any.
     *
     * @param  iterable<CourseMaterialNodeViewModel|array<string, mixed>>  $materialNodes
     * @param  iterable<CourseLearningTimeItemViewModel|array<string, mixed>>  $learningTimeItems
     * @return list<array{identifier: string, href: string|null, text: string, level: int, itemDisabled: bool, duration: string|null}>
     */
    public static function sourceNodes(iterable $materialNodes, iterable $learningTimeItems): array
    {
        $items = [...$learningTimeItems];
        $source = $items !== [] ? $items : [...$materialNodes];

        return array_map(static function (CourseMaterialNodeViewModel|CourseLearningTimeItemViewModel|array $node): array {
            if (is_array($node)) {
                return [
                    'identifier' => (string) ($node['identifier'] ?? ''),
                    'href' => isset($node['href']) ? (string) $node['href'] : null,
                    'text' => (string) ($node['text'] ?? ''),
                    'level' => (int) ($node['level'] ?? 0),
                    'itemDisabled' => (bool) ($node['itemDisabled'] ?? false),
                    'duration' => isset($node['duration']) ? (string) $node['duration'] : null,
                ];
            }

            return [
                'identifier' => $node->identifier,
                'href' => $node->href,
                'text' => $node->text,
                'level' => $node->level,
                'itemDisabled' => $node->itemDisabled,
                'duration' => $node instanceof CourseLearningTimeItemViewModel ? $node->duration : null,
            ];
        }, $source);
    }

    /**
     * A node with children AND its own href becomes a folder row plus a
     * synthetic "link" child (so the parent page stays reachable).
     *
     * @param  list<array{identifier: string, href: string|null, text: string, level: int, itemDisabled: bool, duration: string|null}>  $source
     * @return list<array<string, mixed>>
     */
    public static function build(array $source): array
    {
        $normalized = [];

        foreach ($source as $index => $node) {
            $nextLevel = $source[$index + 1]['level'] ?? -1;
            $hasChildren = $nextLevel > $node['level'];

            if ($hasChildren && $node['href'] !== null && $node['href'] !== '') {
                $normalized[] = [
                    ...$node,
                    'internalId' => $node['identifier'].'::folder',
                    'targetIdentifier' => $node['identifier'].'::folder',
                    'href' => null,
                    'itemDisabled' => true,
                    'duration' => null,
                    'isDirectory' => true,
                    'isSyntheticLink' => false,
                ];
                $normalized[] = [
                    ...$node,
                    'internalId' => $node['identifier'].'::link',
                    'targetIdentifier' => $node['identifier'],
                    'level' => $node['level'] + 1,
                    'itemDisabled' => false,
                    'isDirectory' => false,
                    'isSyntheticLink' => true,
                ];

                continue;
            }

            $normalized[] = [
                ...$node,
                'internalId' => $node['identifier'],
                'targetIdentifier' => $node['identifier'],
                'isDirectory' => $hasChildren,
                'isSyntheticLink' => false,
            ];
        }

        $stack = [];
        $result = [];

        foreach ($normalized as $node) {
            while ($stack !== [] && $stack[array_key_last($stack)]['level'] >= $node['level']) {
                array_pop($stack);
            }

            $parent = $stack !== [] ? $stack[array_key_last($stack)] : null;

            $display = [
                ...$node,
                'ancestorDirectoryIds' => $parent !== null
                    ? [...$parent['ancestorDirectoryIds'], $parent['internalId']]
                    : [],
                'parentInternalId' => $parent['internalId'] ?? null,
            ];

            if ($display['isDirectory']) {
                $stack[] = $display;
            }

            $result[] = $display;
        }

        return $result;
    }

    /**
     * Ancestor folder ids of the active (openable) node, so they can be
     * force-expanded.
     *
     * @param  list<array<string, mixed>>  $nodes
     * @return list<string>
     */
    public static function activeAncestorIds(array $nodes, ?string $activeIdentifier): array
    {
        if ($activeIdentifier === null || $activeIdentifier === '') {
            return [];
        }

        foreach ($nodes as $node) {
            if ($node['targetIdentifier'] === $activeIdentifier && ! empty($node['href']) && ! $node['itemDisabled']) {
                return $node['ancestorDirectoryIds'];
            }
        }

        return [];
    }

    /**
     * @param  list<array<string, mixed>>  $nodes
     * @param  list<string>  $collapsedIds
     * @return list<array<string, mixed>>
     */
    public static function visible(array $nodes, array $collapsedIds): array
    {
        return array_values(array_filter(
            $nodes,
            static fn (array $node): bool => array_intersect($node['ancestorDirectoryIds'], $collapsedIds) === [],
        ));
    }

    public static function formatClock(int|float $totalSeconds): string
    {
        $safe = max(0, (int) floor($totalSeconds));
        $hours = intdiv($safe, 3600);
        $minutes = intdiv($safe % 3600, 60);
        $seconds = str_pad((string) ($safe % 60), 2, '0', STR_PAD_LEFT);

        if ($hours > 0) {
            return $hours.':'.str_pad((string) $minutes, 2, '0', STR_PAD_LEFT).':'.$seconds;
        }

        return $minutes.':'.$seconds;
    }

    public static function lastSeenLabel(?int $positionSeconds, ?int $durationSeconds): string
    {
        if ($positionSeconds === null || $durationSeconds === null || $durationSeconds <= 0) {
            return '上次看到';
        }

        return '上次看到 '.self::formatClock(min($positionSeconds, $durationSeconds)).' / '.self::formatClock($durationSeconds);
    }
}
