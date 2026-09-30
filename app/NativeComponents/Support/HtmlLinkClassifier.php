<?php

declare(strict_types=1);

namespace App\NativeComponents\Support;

/**
 * Decides what a tapped link inside school-authored HTML means (port of
 * Material.vue's handleContentLinkClick).
 *
 * Kinds, checked in this order:
 *  - `node`: the URL equals (host, path, query) the href of a known material
 *    node; `identifier` names that node.
 *  - `subpage`: same host as the active node's own URL but no node of its
 *    own, i.e. another page of the same material.
 *  - `tronclass`: a tronclass.nou.edu.tw / nou.tronclass.com.tw URL.
 *  - `external`: everything else.
 */
final class HtmlLinkClassifier
{
    private const array TRONCLASS_PREFIXES = [
        'https://tronclass.nou.edu.tw/',
        'https://nou.tronclass.com.tw/',
    ];

    /**
     * @param  list<array{identifier: string, href: string|null}>  $nodes
     * @return array{kind: 'node'|'subpage'|'tronclass'|'external', url: string, identifier: string|null}
     */
    public static function classify(string $url, array $nodes = [], ?string $activeNodeUrl = null): array
    {
        $target = parse_url($url);

        foreach ($nodes as $node) {
            $nodeParts = $node['href'] !== null ? parse_url($node['href']) : false;

            if ($nodeParts !== false && $target !== false && self::samePage($nodeParts, $target)) {
                return ['kind' => 'node', 'url' => $url, 'identifier' => $node['identifier']];
            }
        }

        if ($activeNodeUrl !== null && $target !== false) {
            $active = parse_url($activeNodeUrl);

            if ($active !== false && isset($active['host'], $target['host']) && $active['host'] === $target['host']) {
                return ['kind' => 'subpage', 'url' => $url, 'identifier' => null];
            }
        }

        foreach (self::TRONCLASS_PREFIXES as $prefix) {
            if (str_starts_with($url, $prefix)) {
                return ['kind' => 'tronclass', 'url' => $url, 'identifier' => null];
            }
        }

        return ['kind' => 'external', 'url' => $url, 'identifier' => null];
    }

    /**
     * URLs the webview reports for its own initial content, never a link tap.
     */
    public static function isInternalLoad(string $url): bool
    {
        return $url === '' || preg_match('#^(about|data|blob):#i', $url) === 1;
    }

    /**
     * @param  array<string, int|string>  $a
     * @param  array<string, int|string>  $b
     */
    private static function samePage(array $a, array $b): bool
    {
        return ($a['host'] ?? null) === ($b['host'] ?? null)
            && ($a['path'] ?? '') === ($b['path'] ?? '')
            && ($a['query'] ?? '') === ($b['query'] ?? '');
    }
}
