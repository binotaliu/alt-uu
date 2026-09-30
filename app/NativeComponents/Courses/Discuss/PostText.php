<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses\Discuss;

/**
 * Pure helpers for forum post bodies.
 *
 * Most posts are plain paragraphs. Rendering each of those through a
 * `native:html-view` (one embedded web view per post) is expensive on long
 * threads, so `plain()` recognises sanitised HTML that has no markup beyond
 * attribute-free `<p>`, `<div>` and `<br>` and returns it as text for
 * `native:text`. Anything richer (links, images, lists, inline styles, ...)
 * returns null and must go through `<native:html-content>`.
 */
final class PostText
{
    private const array DOWNLOAD_EXTENSIONS = [
        'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'txt', 'zip', 'rar', '7z', 'odt', 'ods', 'odp', 'mp3', 'mp4', 'm4a', 'wav',
    ];

    /**
     * Text of a markup-free post, or null when the HTML needs a web view.
     */
    public static function plain(?string $html): ?string
    {
        if ($html === null || trim($html) === '') {
            return '';
        }

        $withoutBreaks = (string) preg_replace('#<(?:/?(?:p|div)|br)\s*/?>#i', '', $html);

        if (str_contains($withoutBreaks, '<')) {
            return null;
        }

        $text = (string) preg_replace('#<br\s*/?>#i', "\n", $html);
        $text = (string) preg_replace('#</(?:p|div)>#i', "\n", $text);
        $text = (string) preg_replace('#<(?:p|div)>#i', '', $text);

        return self::normalise($text);
    }

    /**
     * Whisper bodies are stored with `nl2br(htmlspecialchars())`, so decode
     * them back to text (and drop any stray tag).
     */
    public static function whisper(?string $content): string
    {
        if ($content === null || trim($content) === '') {
            return '';
        }

        $text = (string) preg_replace('#<br\s*/?>#i', "\n", $content);

        return self::normalise(strip_tags($text));
    }

    /**
     * Decides whether a tapped link is an attachment (a school file, or a
     * `/material-proxy/{base64url}` URL of the old web app) that should go
     * through the download flow instead of the in-app browser.
     *
     * @return array{href: string, filename: string}|null
     */
    public static function downloadTarget(string $url, ?string $schoolBaseUrl): ?array
    {
        $path = (string) parse_url($url, PHP_URL_PATH);

        if (preg_match('#/material-proxy/([A-Za-z0-9_-]+)#', $path, $matches) === 1) {
            $decoded = base64_decode(strtr($matches[1], '-_', '+/'), true);

            if (is_string($decoded) && preg_match('#^https?://#i', $decoded) === 1) {
                return ['href' => $decoded, 'filename' => self::filenameOf($decoded)];
            }

            return null;
        }

        $schoolHost = $schoolBaseUrl !== null ? parse_url($schoolBaseUrl, PHP_URL_HOST) : null;

        if (! is_string($schoolHost) || strcasecmp((string) parse_url($url, PHP_URL_HOST), $schoolHost) !== 0) {
            return null;
        }

        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        return in_array($extension, self::DOWNLOAD_EXTENSIONS, true)
            ? ['href' => $url, 'filename' => self::filenameOf($url)]
            : null;
    }

    private static function filenameOf(string $url): string
    {
        $name = basename((string) parse_url($url, PHP_URL_PATH));

        return $name !== '' ? urldecode($name) : '附件';
    }

    private static function normalise(string $text): string
    {
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = str_replace("\u{00A0}", ' ', $text);
        $text = (string) preg_replace("/[ \t]+\n/", "\n", str_replace("\r", '', $text));
        $text = (string) preg_replace("/\n{3,}/", "\n\n", $text);

        return trim($text);
    }
}
