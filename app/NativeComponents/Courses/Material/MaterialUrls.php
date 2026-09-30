<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses\Material;

/**
 * URL helpers of the Material screen.
 *
 * `ParseMaterialContent` returns upstream URLs, which the native html view and
 * player load themselves.
 */
final class MaterialUrls
{
    private const array TRONCLASS_PREFIXES = [
        'https://tronclass.nou.edu.tw/',
        'https://nou.tronclass.com.tw/',
    ];

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
