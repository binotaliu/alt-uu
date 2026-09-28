<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Support;

use Illuminate\Support\Arr;

/**
 * Flattens the raw `my-course-path-info` tree exactly the way the course
 * directory does, but WITHOUT the normalisation CourseMaterialNodeViewModel
 * applies (about:blank becoming null). The whole point of the material source
 * tool is to see what the school actually sent.
 */
final class MaterialPathNodes
{
    /**
     * @param  array<string, mixed>  $payload
     * @return list<array<string, mixed>>
     */
    public static function flatten(array $payload): array
    {
        $items = Arr::get($payload, 'data.path.item', []);

        return is_array($items) ? self::walk($items, 0) : [];
    }

    /**
     * @param  array<int|string, mixed>  $nodes
     * @return list<array<string, mixed>>
     */
    private static function walk(array $nodes, int $level): array
    {
        $result = [];

        foreach ($nodes as $node) {
            if (! is_array($node)) {
                continue;
            }

            $children = $node['item'] ?? [];
            $entry = $node;
            $entry['level'] = $level;
            unset($entry['item']);
            $result[] = $entry;

            if (is_array($children) && $children !== []) {
                $result = [...$result, ...self::walk($children, $level + 1)];
            }
        }

        return $result;
    }
}
