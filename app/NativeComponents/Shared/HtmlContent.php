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
 * embeds inside a native screen. It renders through the in-repo
 * `altuu/plugin-html-view` element (`<native:html-view>`), which, unlike the
 * stock `native:webview`, intercepts link taps BEFORE navigation, reports its
 * content height and carries a JS-to-PHP message bridge.
 *
 * Tag (HTML):
 *   `<native:html-content key="post-{{ $id }}" :html="$html" base-url="{{ $node->href }}" appearance="auto" :font-scale="$fontScale" :node-links="$nodeLinks" :active-node-url="$node->href" :auto-height="true" @node-link="openNode" @subpage-link="loadSubpage" @tronclass-link="openTronclass" @external-link="openExternal" @height="onPostHeight" />`
 * Tag (YouTube): `<native:html-content key="video" embed-url="https://www.youtube.com/embed/ID" @progress="onProgress" />`
 *
 * Props:
 *  - `html` (string) trusted, already sanitised upstream.
 *  - `baseUrl` (?string) used to make relative `href`/`src` absolute.
 *  - `appearance` (`auto` default = device appearance via isDark(), `light`, `dark`).
 *    In dark mode inline colours are remapped (port of lib/htmlColorScheme.ts).
 *  - `fontScale` (float 0.7..1.6, default 1.0) scales the base font size in the
 *    document CSS (the element's own native `font_scale` is deliberately NOT
 *    used, so the scale is not applied twice).
 *  - `nodeLinks` (list of `['identifier' => string, 'href' => ?string]`, or
 *    CourseMaterialNodeViewModel[]) used to recognise links to other nodes.
 *  - `activeNodeUrl` (?string) the current node URL, to recognise sub-pages.
 *  - `embedUrl` (?string) switches to embed mode; only
 *    https://www.youtube.com|youtube-nocookie.com/embed/... and the app's
 *    statics `youtube-embed.html` wrapper are accepted.
 *  - `autoHeight` (bool, default false) the view sizes itself to its content,
 *    so several can be stacked inside a scroll-view (forum posts). When false
 *    the host must give it a bounded parent (`h-full` column / `flex-1`).
 *  - `estimatedHeight` (?float) height used until the first measurement.
 *  - `webviewClass` (string, default `w-full flex-1`; `w-full` when
 *    `autoHeight` and left at the default) size classes of the view.
 *  - `autoRestore` (bool) accepted for backwards compatibility and ignored:
 *    links are now cancelled before navigation, so there is nothing to restore.
 *
 * Events (argument order is fixed):
 *  - `node-link` (`identifier`, `url`)   a known material node
 *  - `subpage-link` (`url`)              same host as `activeNodeUrl`, no node
 *  - `tronclass-link` (`url`)            tronclass.nou.edu.tw / nou.tronclass.com.tw
 *  - `mailto-link` (`url`), `tel-link` (`url`)  hand to `Browser::open()`
 *  - `external-link` (`url`)             any other http(s) URL (also every
 *    top-level link tap and target=_blank link in embed mode)
 *  - `height` (`float $height`)          content height (informational; the
 *    view already adopts it natively), only sent when it changed by >= 2
 *  - `message` (`array $payload`)        decoded JSON the page posted through
 *    `AltUUBridge.postMessage` (embed mode only; HTML mode runs no page JS)
 *  - `progress` (`?float $currentTime`, `?float $duration`)  seconds, from the
 *    YouTube wrapper's `source: 'altuu-youtube-embed'` messages
 * A link tap never navigates the view: the native side cancels it and this
 * component classifies the URL.
 */
final class HtmlContent extends NativeComponent
{
    private const array EMBED_HOSTS = ['www.youtube.com', 'www.youtube-nocookie.com'];

    private const string PROGRESS_SOURCE = 'altuu-youtube-embed';

    /**
     * Forwards the YouTube wrapper page's `window.postMessage` progress to the
     * native bridge. The wrapper is loaded top-level, so its `parent` is its
     * own window and a plain `message` listener sees the traffic.
     */
    private const string EMBED_USER_SCRIPT = <<<'JS'
        window.addEventListener('message', function (event) {
            var data = event.data;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (error) { return; }
            }
            if (data && data.source === 'altuu-youtube-embed' && window.AltUUBridge) {
                window.AltUUBridge.postMessage(data);
            }
        });
        JS;

    public string $html = '';

    public ?string $baseUrl = null;

    public string $appearance = 'auto';

    public float $fontScale = 1.0;

    /** @var array<int, mixed>|Traversable<int, mixed> */
    public array|Traversable $nodeLinks = [];

    public ?string $activeNodeUrl = null;

    public ?string $embedUrl = null;

    public bool $autoHeight = false;

    public ?float $estimatedHeight = null;

    public string $webviewClass = 'w-full flex-1';

    public bool $autoRestore = true;

    /**
     * Native `on-link-tap` handler. Receives JSON `{"url","scheme","newWindow"}`.
     */
    public function onLinkTap(string $payload): void
    {
        $tap = json_decode($payload, true);
        $url = is_array($tap) && is_string($tap['url'] ?? null) ? $tap['url'] : '';

        if ($url === '' || HtmlLinkClassifier::isInternalLoad($url)) {
            return;
        }

        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));

        if ($scheme === 'mailto' || $scheme === 'tel') {
            $this->emit($scheme.'-link', $url);

            return;
        }

        if ($scheme !== 'http' && $scheme !== 'https') {
            return;
        }

        if ($this->embedUrl !== null) {
            $this->emit('external-link', $url);

            return;
        }

        $link = HtmlLinkClassifier::classify($url, $this->normalizedNodeLinks(), $this->activeNodeUrl);

        match ($link['kind']) {
            'node' => $this->emit('node-link', $link['identifier'], $link['url']),
            'subpage' => $this->emit('subpage-link', $link['url']),
            'tronclass' => $this->emit('tronclass-link', $link['url']),
            'external' => $this->emit('external-link', $link['url']),
        };
    }

    /**
     * Native `on-height-change` handler. Receives the height as a decimal string.
     */
    public function onHeight(string $height): void
    {
        if (is_numeric($height)) {
            $this->emit('height', (float) $height);
        }
    }

    /**
     * Native `on-message` handler. Receives the raw JSON string the page posted.
     */
    public function onMessage(string $payload): void
    {
        $message = json_decode($payload, true);

        if (! is_array($message)) {
            return;
        }

        $this->emit('message', $message);

        if (($message['source'] ?? null) !== self::PROGRESS_SOURCE) {
            return;
        }

        $currentTime = $message['currentTime'] ?? null;
        $duration = $message['duration'] ?? null;

        $this->emit(
            'progress',
            is_numeric($currentTime) && is_finite((float) $currentTime) ? (float) $currentTime : null,
            is_numeric($duration) && is_finite((float) $duration) && (float) $duration > 0 ? (float) $duration : null,
        );
    }

    public static function isAllowedEmbedUrl(?string $url): bool
    {
        if ($url === null) {
            return false;
        }

        $parts = parse_url($url);

        if ($parts === false || ($parts['scheme'] ?? '') !== 'https') {
            return false;
        }

        if (in_array($parts['host'] ?? '', self::EMBED_HOSTS, true) && str_starts_with($parts['path'] ?? '', '/embed/')) {
            return true;
        }

        $statics = parse_url((string) config('services.statics.base_url'));

        return $statics !== false
            && isset($statics['host'])
            && ($parts['host'] ?? '') === $statics['host']
            && ($parts['path'] ?? '') === rtrim($statics['path'] ?? '', '/').'/youtube-embed.html';
    }

    public function render(): View
    {
        $isEmbed = $this->embedUrl !== null;

        return view('native.shared.html-content', [
            'isEmbed' => $isEmbed,
            'embedAllowed' => self::isAllowedEmbedUrl($this->embedUrl),
            'document' => $isEmbed ? '' : $this->document(),
            'autoHeight' => $this->autoHeight,
            'estimatedHeight' => $this->estimatedHeight,
            'colorScheme' => in_array($this->appearance, ['light', 'dark'], true) ? $this->appearance : null,
            'htmlViewClass' => $this->autoHeight && $this->webviewClass === 'w-full flex-1' ? 'w-full' : $this->webviewClass,
            'embedUserScript' => self::EMBED_USER_SCRIPT,
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

        return HtmlContentDocument::build($this->html, $this->baseUrl, $isDark, $this->fontScale, [
            'text' => (string) config("native-ui.theme.{$mode}.on-background", $isDark ? '#f4f4f5' : '#1c1917'),
            'link' => (string) config("native-ui.theme.{$mode}.accent", $isDark ? '#93c5fd' : '#1d4ed8'),
            'border' => (string) config("native-ui.theme.{$mode}.outline", $isDark ? '#52525b' : '#d4d4d8'),
            'muted' => (string) config("native-ui.theme.{$mode}.on-surface-variant", $isDark ? '#a1a1aa' : '#52525b'),
        ]);
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
