<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses\Material;

use AltUU\Domains\Course\Support\MaterialProxyUrl;

/**
 * URL helpers of the Material screen.
 *
 * `ParseMaterialContent` was written for the WebView, so it rewrites
 * same-host `src` attributes, subtitle URLs and download URLs to the local
 * `material-proxy/{encoded}` route. The native html view and player load
 * URLs themselves and cannot reach that route, so they get the upstream URL
 * back (decoded from the proxy URL).
 */
final class MaterialUrls
{
    private const string PROXY_PATTERN = '#https?://[^\s"\'<>]*?/material-proxy/([A-Za-z0-9_-]+)(?:\?[^\s"\'<>]*)?#';

    private const array TRONCLASS_PREFIXES = [
        'https://tronclass.nou.edu.tw/',
        'https://nou.tronclass.com.tw/',
    ];

    /**
     * Upstream URL behind a proxy URL; every other URL is returned as it is.
     */
    public static function direct(?string $url): ?string
    {
        if ($url === null || $url === '') {
            return $url;
        }

        if (preg_match(self::PROXY_PATTERN, $url, $matches) !== 1) {
            return $url;
        }

        return MaterialProxyUrl::decode($matches[1]) ?? $url;
    }

    /**
     * Replaces every proxy URL inside an HTML fragment by its upstream URL.
     */
    public static function directHtml(?string $html): string
    {
        if ($html === null || $html === '') {
            return '';
        }

        return preg_replace_callback(
            self::PROXY_PATTERN,
            static fn (array $matches): string => MaterialProxyUrl::decode($matches[1]) ?? $matches[0],
            $html,
        ) ?? $html;
    }

    public static function isTronclass(string $url): bool
    {
        foreach (self::TRONCLASS_PREFIXES as $prefix) {
            if (str_starts_with($url, $prefix)) {
                return true;
            }
        }

        return false;
    }

    public static function sameHost(?string $first, ?string $second): bool
    {
        $firstHost = is_string($first) ? parse_url($first, PHP_URL_HOST) : null;
        $secondHost = is_string($second) ? parse_url($second, PHP_URL_HOST) : null;

        return is_string($firstHost) && $firstHost !== '' && $firstHost === $secondHost;
    }

    /**
     * File name for the attachment row (port of `buildDownloadFilename`).
     */
    public static function downloadFilename(?string $fileName, ?string $extension, bool $isPdf, string $title): string
    {
        if ($fileName !== null && $fileName !== '') {
            return $fileName;
        }

        $extension = $extension !== null && $extension !== '' ? $extension : ($isPdf ? 'pdf' : 'bin');
        $title = trim($title);

        if ($title === '') {
            return "material.{$extension}";
        }

        $normalized = (string) preg_replace('/\s+/', ' ', str_replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], '_', $title));

        return str_ends_with(strtolower($normalized), '.'.strtolower($extension)) ? $normalized : "{$normalized}.{$extension}";
    }

    /**
     * "1 時 02 分 03 秒" style label of the resume prompt (port of `formatSecondsLabel`).
     */
    public static function secondsLabel(float|int $total): string
    {
        $total = max(0, (int) floor($total));
        $hours = intdiv($total, 3600);
        $minutes = intdiv($total % 3600, 60);
        $seconds = $total % 60;

        if ($hours > 0) {
            return sprintf('%d 時 %02d 分 %02d 秒', $hours, $minutes, $seconds);
        }

        if ($minutes > 0) {
            return sprintf('%d 分 %02d 秒', $minutes, $seconds);
        }

        return "{$seconds} 秒";
    }

    /**
     * "mm:ss" clock of the study timer (port of `formatSeconds`).
     */
    public static function clock(int $total): string
    {
        $total = max(0, $total);

        return sprintf('%02d:%02d', intdiv($total, 60), $total % 60);
    }
}
