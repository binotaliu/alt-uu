<?php

declare(strict_types=1);

namespace App\NativeComponents\Support;

use Dom\Element;
use Dom\HTMLDocument;

/**
 * Builds the standalone HTML document handed to `<native:webview html="...">`.
 *
 * The webview loads inline HTML with a null base URL (opaque origin), no
 * cookies and, by default, no JavaScript, so everything the page needs has to
 * be baked in here:
 *  - relative `href` / `src` values are made absolute against `$baseUrl`;
 *  - `<script>`, inline event handlers and `target` attributes are dropped;
 *  - in dark mode inline colours are remapped (HtmlColorScheme);
 *  - a stylesheet applies the theme colours, link colour and font scale over
 *    a transparent background so the native surface shows through.
 */
final class HtmlContentDocument
{
    public const float FONT_SCALE_MIN = 0.7;

    public const float FONT_SCALE_MAX = 1.6;

    public const float FONT_SCALE_DEFAULT = 1.0;

    /**
     * @param  array<string, string>  $colors  keys `text`, `link`, `border`, `muted`
     */
    public static function build(string $html, ?string $baseUrl, bool $isDark, float $fontScale, array $colors): string
    {
        $body = self::prepareBody($html, $baseUrl, $isDark);
        $scale = self::clampFontScale($fontScale);
        $fontSize = rtrim(rtrim(number_format(16 * $scale, 2, '.', ''), '0'), '.');
        $scheme = $isDark ? 'dark' : 'light';

        $css = <<<CSS
        :root{color-scheme:{$scheme}}
        html,body{margin:0;padding:0;background:transparent}
        body{padding:16px;font-family:-apple-system,system-ui,'Noto Sans TC',sans-serif;font-size:{$fontSize}px;line-height:1.65;color:{$colors['text']};word-wrap:break-word;overflow-wrap:anywhere;-webkit-text-size-adjust:100%}
        a{color:{$colors['link']}}
        img,video,iframe,table{max-width:100%;height:auto}
        table{border-collapse:collapse}
        td,th{border:1px solid {$colors['border']};padding:4px 8px}
        pre,code{font-family:ui-monospace,Menlo,monospace;white-space:pre-wrap}
        blockquote{margin:1em 0;padding-left:1em;border-left:3px solid {$colors['border']};color:{$colors['muted']}}
        CSS;

        $csp = "default-src 'none'; img-src https: http: data:; media-src https: http: data:; style-src 'unsafe-inline'; font-src https: data:";

        return '<!DOCTYPE html><html><head><meta charset="utf-8">'
            .'<meta name="viewport" content="width=device-width, initial-scale=1">'
            .'<meta http-equiv="Content-Security-Policy" content="'.htmlspecialchars($csp, ENT_QUOTES).'">'
            .'<style>'.$css.'</style></head><body>'.$body.'</body></html>';
    }

    public static function clampFontScale(float $scale): float
    {
        return max(self::FONT_SCALE_MIN, min(self::FONT_SCALE_MAX, $scale));
    }

    /**
     * Resolves a possibly relative reference against a base URL. Absolute
     * http(s) URLs, `#fragments` and non-web schemes are returned unchanged.
     */
    public static function absolutize(string $reference, ?string $baseUrl): string
    {
        $reference = trim($reference);

        if ($reference === '' || $baseUrl === null || $baseUrl === '' || str_starts_with($reference, '#')) {
            return $reference;
        }

        if (preg_match('#^[a-z][a-z0-9+.-]*:#i', $reference) === 1) {
            return $reference;
        }

        $base = parse_url($baseUrl);

        if ($base === false || ! isset($base['scheme'], $base['host'])) {
            return $reference;
        }

        $origin = $base['scheme'].'://'.$base['host'].(isset($base['port']) ? ':'.$base['port'] : '');

        if (str_starts_with($reference, '//')) {
            return $base['scheme'].':'.$reference;
        }

        if (str_starts_with($reference, '/')) {
            return $origin.self::removeDotSegments($reference);
        }

        if (str_starts_with($reference, '?')) {
            return $origin.($base['path'] ?? '/').$reference;
        }

        $directory = substr($base['path'] ?? '/', 0, (int) strrpos($base['path'] ?? '/', '/') + 1);

        return $origin.self::removeDotSegments($directory.$reference);
    }

    private static function prepareBody(string $html, ?string $baseUrl, bool $isDark): string
    {
        if (trim($html) === '') {
            return '';
        }

        $document = HTMLDocument::createFromString(
            '<!DOCTYPE html><html><head></head><body>'.$html.'</body></html>',
            LIBXML_NOERROR,
            'UTF-8',
        );

        foreach ($document->querySelectorAll('script, noscript, object, embed, base, meta, link') as $unsafe) {
            $unsafe->remove();
        }

        /** @var Element $element */
        foreach ($document->querySelectorAll('*') as $element) {
            foreach ($element->getAttributeNames() as $name) {
                if (str_starts_with(strtolower($name), 'on')) {
                    $element->removeAttribute($name);
                }
            }

            $element->removeAttribute('target');

            foreach (['href', 'src', 'poster'] as $attribute) {
                if ($element->hasAttribute($attribute)) {
                    $element->setAttribute($attribute, self::absolutize((string) $element->getAttribute($attribute), $baseUrl));
                }
            }

            if ($isDark && $element->hasAttribute('style')) {
                $element->setAttribute('style', HtmlColorScheme::adjustStyleForDark((string) $element->getAttribute('style')));
            }
        }

        return $document->body?->innerHTML ?? '';
    }

    private static function removeDotSegments(string $path): string
    {
        $segments = [];

        foreach (explode('/', $path) as $segment) {
            if ($segment === '..') {
                array_pop($segments);
            } elseif ($segment !== '.') {
                $segments[] = $segment;
            }
        }

        $result = implode('/', $segments);

        return str_starts_with($result, '/') ? $result : '/'.$result;
    }
}
