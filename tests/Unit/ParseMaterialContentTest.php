<?php

use AltUU\Domains\Course\Actions\ParseMaterialContent;
use AltUU\Domains\Course\Support\MaterialProxyUrl;
use App\Services\UUCourseClient;
use App\Services\UUProxyClient;
use Mockery;
use Symfony\Component\DomCrawler\Crawler;
use Tests\TestCase;

uses(TestCase::class);

afterEach(function () {
    Mockery::close();
});

test('it removes empty heading and paragraph tags with no attributes', function () {
    $html = <<<'HTML'
<div>
    <h1>   </h1>
    <p></p>
    <div>
        <h2></h2>
    </div>
    <p>Visible</p>
</div>
HTML;

    $proxyClient = Mockery::mock(UUProxyClient::class);
    $proxyClient->expects('fetchMaterialContent')
        ->with('https://example.com/page')
        ->andReturn(['body' => $html]);

    $courseClient = new UUCourseClient($proxyClient);
    $parser = new ParseMaterialContent($courseClient);
    $result = $parser('https://example.com/page', 'example.com');

    expect($result->htmlContent)
        ->not->toContain('<h1>')
        ->not->toContain('<p></p>')
        ->not->toContain('<h2>')
        ->toContain('Visible');
});

test('it removes tags containing only ideographic or non-breaking spaces', function () {
    $html = <<<'HTML'
<div>
    <h1>　</h1>
    <h2 align="center">&nbsp;</h2>
    <p>　　      </p>
    <blockquote>
        <p>保留這段文字</p>
        <p>　</p>
    </blockquote>
</div>
HTML;

    $proxyClient = Mockery::mock(UUProxyClient::class);
    $proxyClient->expects('fetchMaterialContent')
        ->with('https://example.com/page')
        ->andReturn(['body' => $html]);

    $courseClient = new UUCourseClient($proxyClient);
    $parser = new ParseMaterialContent($courseClient);
    $result = $parser('https://example.com/page', 'example.com');

    expect($result->htmlContent)
        ->not->toContain('<h1>')
        ->not->toContain('<h2>')
        ->not->toContain('<p>　　      </p>')
        ->toContain('保留這段文字');
});

test('it resolves dot dot relative asset urls', function () {
    $html = <<<'HTML'
<div>
    <img src="../img.png" alt="demo">
</div>
HTML;

    $proxyClient = Mockery::mock(UUProxyClient::class);
    $proxyClient->expects('fetchMaterialContent')
        ->with('https://example.com/course/unit/page.html')
        ->andReturn(['body' => $html]);

    $courseClient = new UUCourseClient($proxyClient);
    $parser = new ParseMaterialContent($courseClient);
    $result = $parser('https://example.com/course/unit/page.html', 'example.com');

    $crawler = new Crawler($result->htmlContent);

    $images = $crawler->filter('img');

    expect($images->count())->toBeGreaterThan(0);

    $expectedUrl = route('material.content', ['encodedUrl' => MaterialProxyUrl::encode('https://example.com/course/img.png')]);

    expect($images->first()->attr('src'))->toBe($expectedUrl);
});

test('it preserves same-host src after purification in nativephp context', function () {
    // Upstream always sends https:// URLs; this test verifies Purifier does not strip them
    // and they are correctly rewritten to the proxy route (which may become php:// in NativePHP).
    $html = '<div><img src="https://example.com/710071.jpg" alt="封面圖片" width="900" height="600"></div>';

    $proxyClient = Mockery::mock(UUProxyClient::class);
    $proxyClient->expects('fetchMaterialContent')
        ->with('https://example.com/page.html')
        ->andReturn(['body' => $html]);

    $courseClient = new UUCourseClient($proxyClient);
    $parser = new ParseMaterialContent($courseClient);
    $result = $parser('https://example.com/page.html', 'example.com');

    $expectedSrc = route('material.content', ['encodedUrl' => MaterialProxyUrl::encode('https://example.com/710071.jpg')]);
    expect($result->htmlContent)->toContain('src="'.$expectedSrc.'"');
});
