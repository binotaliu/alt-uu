<?php

use AltUU\Domains\Course\Actions\ParseMaterialContent;
use AltUU\Domains\Course\Support\MaterialProxyUrl;
use App\Services\UUCourseClient;
use App\Services\UUProxyClient;
use Mockery as MockeryManager;

afterEach(function () {
    MockeryManager::close();
});

it('parses html content and rewrites same-host resources into material proxy URLs', function () {
    $proxyClient = MockeryManager::mock(UUProxyClient::class);
    $proxyClient
        ->shouldReceive('fetchMaterialContent')
        ->once()
        ->with('https://uu.nou.edu.tw/material/lesson-1.html')
        ->andReturn([
            'body' => '<html><body><h2>第一章內容</h2><img src="/images/cover.jpg" alt="cover"></body></html>',
        ]);

    $courseClient = new UUCourseClient($proxyClient);
    $action = new ParseMaterialContent($courseClient);

    $parsed = $action('https://uu.nou.edu.tw/material/lesson-1.html', 'uu.nou.edu.tw');

    expect($parsed->videoUrl)->toBeNull();
    expect($parsed->subtitleUrl)->toBeNull();
    expect($parsed->pdfUrl)->toBeNull();
    expect($parsed->htmlContent)->toContain('第一章內容');

    $expectedProxyUrl = route('material.content', [
        'encodedUrl' => MaterialProxyUrl::encode('https://uu.nou.edu.tw/images/cover.jpg'),
    ]);
    expect($parsed->htmlContent)->toContain($expectedProxyUrl);
});

it('extracts video and subtitle URLs when flowplayer payload exists', function () {
    $proxyClient = MockeryManager::mock(UUProxyClient::class);
    $proxyClient
        ->shouldReceive('fetchMaterialContent')
        ->once()
        ->with('https://uu.nou.edu.tw/material/lesson-2.html')
        ->andReturn([
            'body' => <<<'HTML'
                <html><body>
                <script>
                flowplayer('#player', {
                    src: "https://uu.nou.edu.tw/videos/lesson-2.mp4",
                    subtitles: { tracks: [{ src: "/subs/lesson-2.vtt", label: "zh-TW" }] }
                });
                </script>
                </body></html>
            HTML,
        ]);

    $courseClient = new UUCourseClient($proxyClient);
    $action = new ParseMaterialContent($courseClient);

    $parsed = $action('https://uu.nou.edu.tw/material/lesson-2.html', 'uu.nou.edu.tw');

    expect($parsed->videoUrl)->toBe('https://uu.nou.edu.tw/videos/lesson-2.mp4');
    expect($parsed->pdfUrl)->toBeNull();

    $expectedSubtitleProxy = route('material.content', [
        'encodedUrl' => MaterialProxyUrl::encode('https://uu.nou.edu.tw/subs/lesson-2.vtt'),
    ]);
    expect($parsed->subtitleUrl)->toBe($expectedSubtitleProxy);
});
