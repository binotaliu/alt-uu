<?php

use AltUU\Domains\Course\Support\YoutubeEmbedUrlParser;

it('extracts the video id from a youtube embed redirector url', function () {
    $url = 'https://uu.nou.edu.tw/learn/path/youtubeEmbed.php?v=dQw4w9WgXcQ';

    expect(YoutubeEmbedUrlParser::extractVideoId($url))->toBe('dQw4w9WgXcQ');
});

it('returns null for urls that are not the youtube embed redirector', function () {
    $url = 'https://uu.nou.edu.tw/base/10001/content/101279/introduce.htm';

    expect(YoutubeEmbedUrlParser::extractVideoId($url))->toBeNull();
});

it('returns null when the v query parameter is missing', function () {
    $url = 'https://uu.nou.edu.tw/learn/path/youtubeEmbed.php';

    expect(YoutubeEmbedUrlParser::extractVideoId($url))->toBeNull();
});

it('returns null when the v query parameter contains invalid characters', function () {
    $url = 'https://uu.nou.edu.tw/learn/path/youtubeEmbed.php?v='.rawurlencode('<script>');

    expect(YoutubeEmbedUrlParser::extractVideoId($url))->toBeNull();
});

it('extracts the video id from supported youtube url shapes', function (string $url) {
    expect(YoutubeEmbedUrlParser::extractVideoId($url))->toBe('dQw4w9WgXcQ');
})->with([
    'short link' => 'https://youtu.be/dQw4w9WgXcQ?si=xxxxxx',
    'watch' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s',
    'mobile watch' => 'https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
    'embed' => 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'shorts' => 'https://youtube.com/shorts/dQw4w9WgXcQ',
    'live' => 'https://www.youtube.com/live/dQw4w9WgXcQ?si=abc',
    'nocookie embed' => 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    'lms prefixed short link' => 'https://uu.nou.edu.tw/base/100001/content/999999/https://youtu.be/dQw4w9WgXcQ?si=xxxxxx',
    'lms prefixed watch' => 'https://uu.nou.edu.tw/base/100001/content/999999/https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'lms prefixed with collapsed slashes' => 'https://uu.nou.edu.tw/base/100001/content/999999/https:/youtu.be/dQw4w9WgXcQ',
]);

it('returns null for non-video youtube urls and lookalike hosts', function (string $url) {
    expect(YoutubeEmbedUrlParser::extractVideoId($url))->toBeNull();
})->with([
    'channel page' => 'https://www.youtube.com/@someone',
    'watch without id' => 'https://www.youtube.com/watch',
    'lookalike host' => 'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'lms prefixed non-youtube' => 'https://uu.nou.edu.tw/base/100001/content/999999/https://example.com/watch?v=dQw4w9WgXcQ',
    'invalid id' => 'https://youtu.be/'.'%3Cscript%3E',
]);
