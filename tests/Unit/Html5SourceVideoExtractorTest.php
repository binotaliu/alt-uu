<?php

use AltUU\Domains\Course\Support\VideoExtractors\Html5SourceVideoExtractor;

test('it extracts an m3u8 src from a declarative flowplayer video source', function () {
    $html = <<<'HTML'
        <div id="video" class="flowplayer no-toggle" data-key="$519606731317810">
            <video data-title="" poster="../images/780042.jpg">
                <source type="application/x-mpegurl" src="https://lodm.nou.edu.tw/vod/_definst_/780042/01/01.mp4/playlist.m3u8">
            </video>
        </div>
    HTML;

    $extracted = (new Html5SourceVideoExtractor)->extract($html);

    expect($extracted)->not->toBeNull();
    expect($extracted->videoUrl)->toBe('https://lodm.nou.edu.tw/vod/_definst_/780042/01/01.mp4/playlist.m3u8');
    expect($extracted->subtitleUrl)->toBeNull();
});

test('it picks up a track subtitle when present', function () {
    $html = <<<'HTML'
        <video>
            <source type="application/x-mpegurl" src="https://example.com/playlist.m3u8">
            <track kind="subtitles" src="01.vtt" label="CJK">
        </video>
    HTML;

    $extracted = (new Html5SourceVideoExtractor)->extract($html);

    expect($extracted)->not->toBeNull();
    expect($extracted->videoUrl)->toBe('https://example.com/playlist.m3u8');
    expect($extracted->subtitleUrl)->toBe('01.vtt');
});

test('it returns null when there is no mpegurl source', function () {
    $html = '<div id="wrapper"><h2>課程概覽</h2></div>';

    $extracted = (new Html5SourceVideoExtractor)->extract($html);

    expect($extracted)->toBeNull();
});
