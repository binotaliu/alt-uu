<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Support;

final class MaterialDownloadClassifier
{
    /** @var list<string> */
    private const array BINARY_EXTENSIONS = [
        'zip', 'rar', '7z', 'tar', 'gz',
        'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx',
        'apk', 'ipa', 'exe', 'dmg',
    ];

    /** @var list<string> */
    private const array HTML_EXTENSIONS = ['html', 'htm'];

    /** @var array<string, string> */
    private const array MIME_EXTENSION_MAP = [
        'application/zip' => 'zip',
        'application/x-zip-compressed' => 'zip',
        'application/vnd.rar' => 'rar',
        'application/x-rar-compressed' => 'rar',
        'application/x-7z-compressed' => '7z',
        'application/x-tar' => 'tar',
        'application/gzip' => 'gz',
        'application/msword' => 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        'application/vnd.ms-powerpoint' => 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' => 'pptx',
        'application/vnd.ms-excel' => 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
        'application/vnd.android.package-archive' => 'apk',
    ];

    public static function extractExtension(string $url): string
    {
        $path = (string) (parse_url($url, PHP_URL_PATH) ?? '');
        $extension = pathinfo($path, PATHINFO_EXTENSION);

        return strtolower($extension);
    }

    public static function isHtmlExtension(string $extension): bool
    {
        return in_array($extension, self::HTML_EXTENSIONS, true);
    }

    public static function classifyDownloadable(string $url, string $contentType): ?DownloadClassification
    {
        $contentType = strtolower(trim($contentType));
        $extension = self::extractExtension($url);

        if ($extension === 'pdf' || str_contains($contentType, 'application/pdf')) {
            return DownloadClassification::pdf($extension);
        }

        if (in_array($extension, self::BINARY_EXTENSIONS, true)) {
            return DownloadClassification::binary($extension);
        }

        if ($contentType !== '' && ! self::looksParseable($contentType)) {
            return DownloadClassification::binary($extension !== '' ? $extension : self::guessExtensionFromMime($contentType));
        }

        return null;
    }

    private static function looksParseable(string $contentType): bool
    {
        foreach (['html', 'text/', 'application/xhtml', 'application/json', 'application/xml', 'application/javascript'] as $needle) {
            if (str_contains($contentType, $needle)) {
                return true;
            }
        }

        return false;
    }

    private static function guessExtensionFromMime(string $contentType): string
    {
        foreach (self::MIME_EXTENSION_MAP as $mime => $extension) {
            if (str_contains($contentType, $mime)) {
                return $extension;
            }
        }

        return '';
    }
}
