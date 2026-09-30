<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use App\NativeComponents\Support\HtmlContentDocument;
use App\NativeComponents\Support\HtmlLinkClassifier;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Traversable;

/**
 * Host for school-authored HTML (material bodies, forum posts) and YouTube
 * embeds inside a native screen. This is the ONLY place the app uses
 * `<native:webview>` (explicit, user-approved exception).
 *
 * Tag (HTML):
 *   `<native:html-content key="material-html" :html="$html" base-url="{{ $node->href }}" appearance="auto" :font-scale="$fontScale" :node-links="$nodeLinks" :active-node-url="$node->href" @node-link="openNode" @subpage-link="loadSubpage" @tronclass-link="openTronclass" @external-link="openExternal" />`
 * Tag (YouTube): `<native:html-content key="video" embed-url="https://www.youtube.com/embed/ID" />`
 *
 * Props:
 *  - `html` (string) trusted, already sanitised upstream.
 *  - `baseUrl` (?string) used to make relative `href`/`src` absolute.
 *  - `appearance` (`auto` default = device appearance via isDark(), `light`, `dark`).
 *    In dark mode inline colours are remapped (port of lib/htmlColorScheme.ts).
 *  - `fontScale` (float 0.7..1.6, default 1.0) scales the base font size.
 *  - `nodeLinks` (list of `['identifier' => string, 'href' => ?string]`, or
 *    CourseMaterialNodeViewModel[]) used to recognise links to other nodes.
 *  - `activeNodeUrl` (?string) the current node URL, to recognise sub-pages.
 *  - `embedUrl` (?string) switches to embed mode; only
 *    https://www.youtube.com|youtube-nocookie.com/embed/... is accepted.
 *  - `webviewClass` (string, default `w-full flex-1`) size classes of the
 *    webview. It cannot size itself to its content: the host must give it a
 *    bounded parent (e.g. a `h-full` column), NOT a scroll-view.
 *  - `autoRestore` (bool, default true) see "Link events".
 *
 * Link events (emitted from the webview's `@navigated`, see BLOCKER below):
 *  - `node-link` (`identifier`, `url`)   a known material node
 *  - `subpage-link` (`url`)              same host as `activeNodeUrl`, no node
 *  - `tronclass-link` (`url`)            tronclass.nou.edu.tw / nou.tronclass.com.tw
 *  - `external-link` (`url`)             anything else
 * URLs are the final committed top-frame URL. The initial load and any
 * about:/data:/blob: URL never emit. With `autoRestore` the component reloads
 * the original content right after emitting so the reader is not left on the
 * linked page.
 *
 * BLOCKER (vendor renderer limits, verified in NativeUIWebviewRenderer.swift
 * and WebviewRenderer.kt): the webview only reports `@navigated` AFTER the
 * top-frame navigation committed; a tapped http(s) link cannot be cancelled or
 * intercepted, mailto:/tel:/target=_blank links are dropped silently with no
 * event, and there is no JS message bridge (so no YouTube postMessage
 * progress) and no content-height report.
 */
final class HtmlContent extends NativeComponent
{
    private const array EMBED_HOSTS = ['www.youtube.com', 'www.youtube-nocookie.com'];

    public string $html = '';

    public ?string $baseUrl = null;

    public string $appearance = 'auto';

    public float $fontScale = 1.0;

    /** @var array<int, mixed>|Traversable<int, mixed> */
    public array|Traversable $nodeLinks = [];

    public ?string $activeNodeUrl = null;

    public ?string $embedUrl = null;

    public string $webviewClass = 'w-full flex-1';

    public bool $autoRestore = true;

    public int $reloadNonce = 0;

    public function onNavigated(string $url): void
    {
        if ($this->embedUrl !== null || HtmlLinkClassifier::isInternalLoad($url)) {
            return;
        }

        $link = HtmlLinkClassifier::classify($url, $this->normalizedNodeLinks(), $this->activeNodeUrl);

        match ($link['kind']) {
            'node' => $this->emit('node-link', $link['identifier'], $link['url']),
            'subpage' => $this->emit('subpage-link', $link['url']),
            'tronclass' => $this->emit('tronclass-link', $link['url']),
            'external' => $this->emit('external-link', $link['url']),
        };

        if ($this->autoRestore) {
            $this->restore();
        }
    }

    /**
     * Reloads the original HTML (the webview signature changes with the
     * nonce, which forces a fresh `loadHTMLString`).
     */
    public function restore(): void
    {
        $this->reloadNonce++;
    }

    public static function isAllowedEmbedUrl(?string $url): bool
    {
        if ($url === null) {
            return false;
        }

        $parts = parse_url($url);

        return $parts !== false
            && ($parts['scheme'] ?? '') === 'https'
            && in_array($parts['host'] ?? '', self::EMBED_HOSTS, true)
            && str_starts_with($parts['path'] ?? '', '/embed/');
    }

    public function render(): View
    {
        $isEmbed = $this->embedUrl !== null;

        return view('native.shared.html-content', [
            'isEmbed' => $isEmbed,
            'embedAllowed' => self::isAllowedEmbedUrl($this->embedUrl),
            'document' => $isEmbed ? '' : $this->document(),
        ]);
    }

    private function document(): string
    {
        $isDark = match ($this->appearance) {
            'dark' => true,
            'light' => false,
            default => isDark(),
        };

        $mode = $isDark ? 'dark' : 'light';

        $html = HtmlContentDocument::build($this->html, $this->baseUrl, $isDark, $this->fontScale, [
            'text' => (string) config("native-ui.theme.{$mode}.on-background", $isDark ? '#f4f4f5' : '#1c1917'),
            'link' => (string) config("native-ui.theme.{$mode}.accent", $isDark ? '#93c5fd' : '#1d4ed8'),
            'border' => (string) config("native-ui.theme.{$mode}.outline", $isDark ? '#52525b' : '#d4d4d8'),
            'muted' => (string) config("native-ui.theme.{$mode}.on-surface-variant", $isDark ? '#a1a1aa' : '#52525b'),
        ]);

        return $this->reloadNonce > 0 ? $html.'<!-- reload '.$this->reloadNonce.' -->' : $html;
    }

    /**
     * @return list<array{identifier: string, href: string|null}>
     */
    private function normalizedNodeLinks(): array
    {
        $links = [];

        foreach ($this->nodeLinks as $node) {
            $identifier = is_array($node) ? ($node['identifier'] ?? '') : ($node->identifier ?? '');
            $href = is_array($node) ? ($node['href'] ?? null) : ($node->href ?? null);

            $links[] = ['identifier' => (string) $identifier, 'href' => $href !== null ? (string) $href : null];
        }

        return $links;
    }
}
