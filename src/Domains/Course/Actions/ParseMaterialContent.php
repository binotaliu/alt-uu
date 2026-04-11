<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Actions;

use AltUU\Domains\Course\Actions\Results\ParsedMaterialContentResult;
use AltUU\Domains\Course\Support\MaterialProxyUrl;
use App\Services\UUCourseClient;
use Mews\Purifier\Facades\Purifier;
use Symfony\Component\DomCrawler\Crawler;

final readonly class ParseMaterialContent
{
    public function __construct(private UUCourseClient $courseClient) {}

    public function __invoke(string $url, string $baseHost): ParsedMaterialContentResult
    {
        $materialResult = $this->courseClient->fetchMaterialContent($url);
        $contentType = strtolower((string) ($materialResult['headers']['content-type'] ?? ''));

        if ($this->isPdfMaterial($url, $contentType)) {
            return new ParsedMaterialContentResult(
                videoUrl: null,
                subtitleUrl: null,
                pdfUrl: route('material.content', ['encodedUrl' => MaterialProxyUrl::encode($url)]),
                htmlContent: '',
            );
        }

        $html = $this->ensureUtf8((string) ($materialResult['body'] ?? ''));

        $videoUrl = $this->extractVideoUrl($html);
        $subtitleUrl = null;

        if ($videoUrl !== null) {
            $rawSubtitleSrc = $this->extractSubtitleSrc($html);

            if ($rawSubtitleSrc !== null) {
                $resolvedSubtitleUrl = $this->resolveRelativeUrl($url, $rawSubtitleSrc);

                if ($resolvedSubtitleUrl !== null) {
                    $subtitleHost = parse_url($resolvedSubtitleUrl, PHP_URL_HOST);

                    if (is_string($subtitleHost) && $subtitleHost === $baseHost) {
                        $subtitleUrl = route('material.content', ['encodedUrl' => MaterialProxyUrl::encode($resolvedSubtitleUrl)]);
                    }
                }
            }
        }

        $htmlContent = $this->cleanHtml($html, $url, $baseHost);

        return new ParsedMaterialContentResult(
            videoUrl: $videoUrl,
            subtitleUrl: $subtitleUrl,
            pdfUrl: null,
            htmlContent: $this->ensureUtf8($htmlContent),
        );
    }

    private function isPdfMaterial(string $url, string $contentType): bool
    {
        if (str_contains($contentType, 'application/pdf')) {
            return true;
        }

        $path = (string) (parse_url($url, PHP_URL_PATH) ?? '');

        return str_ends_with(strtolower($path), '.pdf');
    }

    private function extractVideoUrl(string $html): ?string
    {
        if (! preg_match('/flowplayer\s*\(/i', $html)) {
            return null;
        }

        // Match src: "https://..." (absolute URL only — skips relative subtitle paths)
        if (preg_match('/\bsrc\s*:\s*["\'](https?:\/\/[^"\']+)["\']/', $html, $matches)) {
            return $matches[1];
        }

        return null;
    }

    private function extractSubtitleSrc(string $html): ?string
    {
        // Match subtitles: { tracks: [{ src: "...", ... }] }
        if (preg_match('/subtitles\s*:\s*\{[^{}]*tracks\s*:\s*\[\s*\{[^}]*\bsrc\s*:\s*["\']([^"\']+)["\']/', $html, $matches)) {
            return $matches[1];
        }

        return null;
    }

    private function resolveRelativeUrl(string $base, string $relative): ?string
    {
        $relative = trim($relative);

        if ($relative === '') {
            return null;
        }

        if (str_starts_with($relative, 'http://') || str_starts_with($relative, 'https://')) {
            return $relative;
        }

        $parsed = parse_url($base);

        if (! is_array($parsed)) {
            return null;
        }

        $scheme = $parsed['scheme'] ?? 'https';
        $host = $parsed['host'] ?? '';

        if ($host === '') {
            return null;
        }

        $port = isset($parsed['port']) ? ':'.$parsed['port'] : '';

        if (str_starts_with($relative, '//')) {
            return $scheme.':'.$relative;
        }

        if (str_starts_with($relative, '#')) {
            $path = $this->normalizePath((string) ($parsed['path'] ?? '/'));

            return "{$scheme}://{$host}{$port}{$path}{$relative}";
        }

        if (str_starts_with($relative, '?')) {
            $path = $this->normalizePath((string) ($parsed['path'] ?? '/'));

            return "{$scheme}://{$host}{$port}{$path}{$relative}";
        }

        $relativeParts = parse_url($relative);

        if ($relativeParts === false) {
            return null;
        }

        $relativePath = (string) ($relativeParts['path'] ?? '');
        $basePath = (string) ($parsed['path'] ?? '/');

        if (str_starts_with($relativePath, '/')) {
            $path = $relativePath;
        } else {
            $baseDir = preg_replace('#/[^/]*$#', '/', $basePath);
            $path = ($baseDir === null ? '/' : $baseDir).$relativePath;
        }

        $path = $this->normalizePath($path);
        $query = isset($relativeParts['query']) ? '?'.$relativeParts['query'] : '';
        $fragment = isset($relativeParts['fragment']) ? '#'.$relativeParts['fragment'] : '';

        return "{$scheme}://{$host}{$port}{$path}{$query}{$fragment}";
    }

    private function cleanHtml(string $html, string $baseUrl, string $baseHost): string
    {
        $crawler = new Crawler($html);

        // Remove script, style, link, and player elements
        $crawler->filterXPath('//script | //style | //link | //*[@id="player"]')->each(function (Crawler $node) {
            $node->getNode(0)?->parentNode?->removeChild($node->getNode(0));
        });

        // Remove style attributes
        $crawler->filterXPath('//*[@style]')->each(function (Crawler $node) {
            $node->getNode(0)?->removeAttribute('style');
        });

        // Resolve src URLs to absolute
        $crawler->filterXPath('//*[@src]')->each(function (Crawler $node) use ($baseUrl) {
            $this->resolveToAbsoluteUrl($node, $baseUrl);
        });

        // Rewrite anchor attributes
        $crawler->filterXPath('//a[@href]')->each(function (Crawler $node) use ($baseUrl) {
            $this->rewriteAnchorAttributes($node, $baseUrl);
        });

        // Get the underlying DOMDocument from the crawler
        $domNode = $crawler->getNode(0);
        $document = $domNode instanceof \DOMNode && $domNode->ownerDocument instanceof \DOMDocument
            ? $domNode->ownerDocument
            : null;

        if ($document instanceof \DOMDocument) {
            $this->removeEmptyElementsDom($document);
        }

        // Get the body element
        $bodyElements = $crawler->filterXPath('//body');
        $body = null;
        if ($bodyElements->count() > 0) {
            $body = $bodyElements->getNode(0);
        }

        $rawHtml = $body instanceof \DOMNode
            ? trim($this->renderChildHtml($body))
            : trim($this->renderHtml($document ?? $domNode));

        return $this->rewriteProxySrcs($this->purifyHtml($rawHtml), $baseHost);
    }

    private function renderChildHtml(\DOMNode $parent): string
    {
        $html = '';

        foreach ($parent->childNodes as $childNode) {
            $html .= $childNode->ownerDocument?->saveHTML($childNode) ?? '';
        }

        return $html;
    }

    private function renderHtml(?\DOMNode $node): string
    {
        if ($node instanceof \DOMDocument) {
            return $node->saveHTML() ?? '';
        }

        return $node?->ownerDocument?->saveHTML($node) ?? '';
    }

    private function purifyHtml(string $html): string
    {
        // Use Laravel Mews Purifier facade so app config and cache settings are respected.
        $config = [
            'HTML.Allowed' => 'div,b,strong,i,em,u,a[href|title],ul,ol,li,p[style],br,span[style],img[width|height|alt|src],audio[controls|src],video[controls|src|width|height],source[src|type],iframe[src|width|height|allowfullscreen|frameborder],table,tr[rowspan|colspan],th[rowspan|colspan],td[rowspan|colspan],tbody,thead,tfoot',
            'HTML.ForbiddenElements' => 'style,script,link',
            'HTML.SafeIframe' => true,
            'URI.SafeIframeRegexp' => '%^(https?://|/)%',
            'Attr.AllowedRel' => 'noopener,noreferrer',
            'HTML.TargetBlank' => true,
            'CSS.AllowedProperties' => '',
            'HTML.Trusted' => false,
            'Cache.SerializerPath' => storage_path('framework/cache/htmlpurifier'),
        ];

        $config = array_merge(
            config('purifier.settings.default', []),
            $config,
        );

        return Purifier::clean($html, $config);
    }

    private function resolveToAbsoluteUrl(Crawler $element, string $baseUrl): void
    {
        $src = trim((string) ($element->attr('src') ?? ''));

        if ($this->shouldSkipUrlRewrite($src)) {
            return;
        }

        $resolvedUrl = $this->resolveRelativeUrl($baseUrl, $src);

        if ($resolvedUrl !== null) {
            $element->getNode(0)?->setAttribute('src', $resolvedUrl);
        }
    }

    private function rewriteAnchorAttributes(Crawler $element, string $baseUrl): void
    {
        $href = trim((string) ($element->attr('href') ?? ''));
        $element->getNode(0)?->setAttribute('target', '_blank');
        $element->getNode(0)?->setAttribute('rel', 'noopener noreferrer');

        if ($this->shouldSkipUrlRewrite($href)) {
            return;
        }

        $resolvedUrl = $this->resolveRelativeUrl($baseUrl, $href);

        if ($resolvedUrl !== null) {
            $element->getNode(0)?->setAttribute('href', $resolvedUrl);
        }
    }

    private function shouldSkipUrlRewrite(string $url): bool
    {
        if ($url === '') {
            return true;
        }

        foreach (['data:', 'javascript:', 'mailto:', 'tel:', 'blob:'] as $prefix) {
            if (str_starts_with($url, $prefix)) {
                return true;
            }
        }

        return false;
    }

    private function normalizePath(string $path): string
    {
        $segments = explode('/', $path);
        $normalized = [];

        foreach ($segments as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }

            if ($segment === '..') {
                array_pop($normalized);

                continue;
            }

            $normalized[] = $segment;
        }

        return '/'.implode('/', $normalized);
    }

    private function rewriteProxySrcs(string $html, string $baseHost): string
    {
        return preg_replace_callback(
            '/\bsrc="(https?:\/\/[^"]+)"/i',
            function (array $m) use ($baseHost): string {
                $host = parse_url($m[1], PHP_URL_HOST);

                if (is_string($host) && $host === $baseHost) {
                    return 'src="'.route('material.content', ['encodedUrl' => MaterialProxyUrl::encode($m[1])]).'"';
                }

                return $m[0];
            },
            $html,
        ) ?? $html;
    }

    private function removeEmptyElementsDom(\DOMDocument $document): void
    {
        $selectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'p', 'blockquote', 'div'];
        $query = implode('|', array_map(fn (string $tag): string => "//{$tag}", $selectors));

        $xpath = new \DOMXPath($document);

        do {
            $removed = false;
            $nodesToRemove = [];

            // Collect all empty nodes first
            foreach ($xpath->query($query) ?: [] as $node) {
                if (! $node instanceof \DOMElement) {
                    continue;
                }

                // If there are any non-whitespace text nodes or any element children, deem it non-empty.
                $hasMeaningfulChild = false;

                foreach ($node->childNodes as $child) {
                    if ($child->nodeType === XML_ELEMENT_NODE) {
                        $hasMeaningfulChild = true;
                        break;
                    }

                    if ($child->nodeType === XML_TEXT_NODE && $this->stripWhitespace((string) $child->textContent) !== '') {
                        $hasMeaningfulChild = true;
                        break;
                    }
                }

                if (! $hasMeaningfulChild) {
                    $nodesToRemove[] = $node;
                }
            }

            // Now remove the collected nodes
            foreach ($nodesToRemove as $node) {
                $node->parentNode?->removeChild($node);
                $removed = true;
            }
        } while ($removed);
    }

    private function removeEmptyElements(Crawler $crawler): void
    {
        // Deprecated: Use removeEmptyElementsDom instead
    }

    private function stripWhitespace(string $value): string
    {
        $value = preg_replace('/[\s\x{00A0}\x{3000}]+/u', '', $value) ?? $value;
        $value = str_replace('&nbsp;', '', $value);

        return $value;
    }

    private function ensureUtf8(string $value): string
    {
        if ($value === '') {
            return '';
        }

        if (mb_check_encoding($value, 'UTF-8')) {
            return $value;
        }

        $detected = mb_detect_encoding($value, ['UTF-8', 'BIG-5', 'CP950', 'Windows-1252', 'ISO-8859-1'], true);

        if ($detected !== false && $detected !== 'UTF-8') {
            $converted = @mb_convert_encoding($value, 'UTF-8', $detected);

            if (is_string($converted) && $converted !== '') {
                return $converted;
            }
        }

        foreach (['BIG-5', 'CP950', 'Windows-1252', 'ISO-8859-1'] as $encoding) {
            $converted = @mb_convert_encoding($value, 'UTF-8', $encoding);

            if (is_string($converted) && $converted !== '' && mb_check_encoding($converted, 'UTF-8')) {
                return $converted;
            }
        }

        $converted = @iconv('UTF-8', 'UTF-8//IGNORE', $value);

        if (is_string($converted) && $converted !== '') {
            return $converted;
        }

        return mb_convert_encoding($value, 'UTF-8', 'UTF-8');
    }
}
