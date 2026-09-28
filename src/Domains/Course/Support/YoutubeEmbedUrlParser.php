<?php

declare(strict_types=1);

namespace AltUU\Domains\Course\Support;

/**
 * Recognizes the URL shapes course leaves use to point at a YouTube video
 * and hands back the video id directly, instead of fetching and parsing
 * the page:
 *
 *   - the remote LMS's own redirector:
 *     https://uu.nou.edu.tw/learn/path/youtubeEmbed.php?v=dQw4w9WgXcQ
 *   - a plain YouTube url (youtu.be/<id>, youtube.com/watch?v=<id>,
 *     /embed/<id>, /shorts/<id>, /live/<id>, youtube-nocookie.com/embed/<id>)
 *   - a YouTube url the LMS has prefixed with its own content path:
 *     https://uu.nou.edu.tw/base/100001/content/999999/https://youtu.be/dQw4w9WgXcQ?si=xxxxxx
 */
final class YoutubeEmbedUrlParser
{
    private const string VIDEO_ID_PATTERN = '/^[A-Za-z0-9_-]{6,20}$/';

    private const array YOUTUBE_HOSTS = [
        'youtube.com',
        'youtube-nocookie.com',
    ];

    private const string SHORT_HOST = 'youtu.be';

    private const array ID_PATH_PREFIXES = ['embed', 'shorts', 'live', 'v'];

    public static function extractVideoId(string $url): ?string
    {
        $path = (string) (parse_url($url, PHP_URL_PATH) ?? '');

        if (basename($path) === 'youtubeEmbed.php') {
            return self::validated(self::queryParam($url, 'v'));
        }

        return self::extractFromYoutubeUrl($url)
            ?? self::extractFromPrefixedYoutubeUrl($path, $url);
    }

    private static function extractFromPrefixedYoutubeUrl(string $path, string $url): ?string
    {
        if (preg_match('#/(https?):/{1,2}(.+)$#i', $path, $matches) !== 1) {
            return null;
        }

        $query = parse_url($url, PHP_URL_QUERY);
        $embedded = strtolower($matches[1]).'://'.$matches[2].(is_string($query) ? '?'.$query : '');

        return self::extractFromYoutubeUrl($embedded);
    }

    private static function extractFromYoutubeUrl(string $url): ?string
    {
        $host = parse_url($url, PHP_URL_HOST);

        if (! is_string($host)) {
            return null;
        }

        $host = preg_replace('/^(www|m|music)\./i', '', strtolower($host));
        $segments = array_values(array_filter(
            explode('/', (string) (parse_url($url, PHP_URL_PATH) ?? '')),
            static fn (string $segment): bool => $segment !== '',
        ));

        if ($host === self::SHORT_HOST) {
            return self::validated($segments[0] ?? null);
        }

        if (! in_array($host, self::YOUTUBE_HOSTS, true)) {
            return null;
        }

        if (($segments[0] ?? null) === 'watch') {
            return self::validated(self::queryParam($url, 'v'));
        }

        if (in_array($segments[0] ?? null, self::ID_PATH_PREFIXES, true)) {
            return self::validated($segments[1] ?? null);
        }

        return null;
    }

    private static function queryParam(string $url, string $name): ?string
    {
        parse_str((string) (parse_url($url, PHP_URL_QUERY) ?? ''), $params);

        return is_string($params[$name] ?? null) ? $params[$name] : null;
    }

    private static function validated(?string $videoId): ?string
    {
        $videoId = trim((string) $videoId);

        if ($videoId === '' || preg_match(self::VIDEO_ID_PATTERN, $videoId) !== 1) {
            return null;
        }

        return $videoId;
    }
}
