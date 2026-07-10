<?php

use AltUU\Domains\Course\Support\VideoExtractors\FlowplayerJsConfigVideoExtractor;

test('it extracts video and subtitle urls from a flowplayer js config', function () {
    $html = <<<'HTML'
        <div id="player"></div>
        <script>
        window.player = flowplayer("#player", {
            token: "fake-token",
            src: "https://example.com/video/playlist.m3u8",
            subtitles: { tracks: [{ src: "01.vtt", label: "CJK", default: true }] },
        });
        </script>
    HTML;

    $extracted = (new FlowplayerJsConfigVideoExtractor)->extract($html);

    expect($extracted)->not->toBeNull();
    expect($extracted->videoUrl)->toBe('https://example.com/video/playlist.m3u8');
    expect($extracted->subtitleUrl)->toBe('01.vtt');
});

test('it returns null when there is no flowplayer js config', function () {
    $html = '<div id="wrapper"><h2>課程概覽</h2></div>';

    $extracted = (new FlowplayerJsConfigVideoExtractor)->extract($html);

    expect($extracted)->toBeNull();
});

test('it returns null when flowplayer is called without an absolute src', function () {
    $html = <<<'HTML'
        <script>
        window.player = flowplayer("#player", {
            src: "relative/playlist.m3u8",
        });
        </script>
    HTML;

    $extracted = (new FlowplayerJsConfigVideoExtractor)->extract($html);

    expect($extracted)->toBeNull();
});
