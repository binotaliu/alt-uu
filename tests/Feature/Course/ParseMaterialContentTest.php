<?php

use AltUU\Domains\Course\Support\MaterialProxyUrl;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;

use function Pest\Laravel\get;
use function Pest\Laravel\getJson;

beforeEach(function () {
    $session = [
        'base_url' => 'https://example.com',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie'],
        'profile' => ['display_name' => '測試', 'username' => 's123'],
    ];

    app(UUSessionStore::class)->put($session);
});

it('rejects requests for external hosts', function () {
    $response = getJson('/materials/content/parsed?url=https://evil.example.com/page.html');

    $response->assertForbidden();
});

it('returns video url and cleaned html for video content', function () {
    $videoHtml = <<<'HTML'
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8" />
        <title>01</title>
        <link rel="stylesheet" href="https://cdn.flowplayer.com/flowplayer.css" />
        </head>
        <body>
        <div class="container">
          <div id="player"></div>
        </div>
        <script src="https://cdn.flowplayer.com/flowplayer.min.js"></script>
        <script>
        window.player = flowplayer("#player", {
            token: "fake-token",
            src: "https://example.com/video/playlist.m3u8",
            subtitles: { tracks: [{ src: "01.vtt", label: "CJK", default: true }] },
        });
        </script>
        <div id="wrapper">
        <h2>測試影片內容</h2>
        </div>
        </body>
        </html>
    HTML;

    Http::fake([
        'https://example.com/page.html' => Http::response(
            $videoHtml,
            200,
            ['content-type' => 'text/html; charset=utf-8'],
        ),
    ]);

    $response = getJson('/materials/content/parsed?url=https://example.com/page.html');

    $response->assertOk();
    $response->assertJsonPath('videoUrl', 'https://example.com/video/playlist.m3u8');
    $response->assertJsonStructure(['videoUrl', 'subtitleUrl', 'pdfUrl', 'htmlContent']);

    $data = $response->json();
    $expectedSubtitleUrl = route('material.content', ['encodedUrl' => MaterialProxyUrl::encode('https://example.com/01.vtt')]);
    expect($data['subtitleUrl'])->toBe($expectedSubtitleUrl);
    expect($data['pdfUrl'])->toBeNull();
    expect($data['htmlContent'])->not->toContain('<script');
    expect($data['htmlContent'])->not->toContain('flowplayer');
    expect($data['htmlContent'])->not->toContain('id="player"');
    expect($data['htmlContent'])->toContain('測試影片內容');
});

it('returns null video url for html-only content', function () {
    $plainHtml = <<<'HTML'
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Overview</title></head>
        <body>
        <div id="wrapper">
        <h2>課程概覽</h2>
        <table><tr><td>主題</td><td>範例課程</td></tr></table>
        </div>
        </body>
        </html>
    HTML;

    Http::fake([
        'https://example.com/content/overview.html' => Http::response(
            $plainHtml,
            200,
            ['content-type' => 'text/html; charset=utf-8'],
        ),
    ]);

    $response = getJson('/materials/content/parsed?url=https://example.com/content/overview.html');

    $response->assertOk();
    $response->assertJsonPath('videoUrl', null);
    $response->assertJsonPath('subtitleUrl', null);
    $response->assertJsonPath('pdfUrl', null);

    $data = $response->json();
    expect($data['htmlContent'])->toContain('課程概覽');
});

it('returns pdf url for pdf material links', function () {
    $pdfBody = '%PDF-1.7 fake';

    Http::fake([
        'https://example.com/content/files/lesson.pdf' => Http::response(
            $pdfBody,
            200,
            ['content-type' => 'application/pdf'],
        ),
    ]);

    $url = 'https://example.com/content/files/lesson.pdf';
    $response = getJson('/materials/content/parsed?url='.rawurlencode($url));

    $response->assertOk();

    $data = $response->json();
    $expectedPdfUrl = route('material.content', ['encodedUrl' => MaterialProxyUrl::encode($url)]);

    expect($data['videoUrl'])->toBeNull();
    expect($data['subtitleUrl'])->toBeNull();
    expect($data['pdfUrl'])->toBe($expectedPdfUrl);
    expect($data['htmlContent'])->toBe('');
});

it('rewrites relative src and anchor href attributes in parsed html', function () {
    $plainHtml = <<<'HTML'
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Overview</title></head>
        <body>
        <div id="wrapper">
            <img src="images/cover.jpg" alt="cover">
            <iframe src="/media/embed/player.html"></iframe>
            <a href="../files/lesson.pdf">講義下載</a>
            <a href="#section-2">章節二</a>
        </div>
        </body>
        </html>
    HTML;

    Http::fake([
        'https://example.com/content/unit/page.html' => Http::response(
            $plainHtml,
            200,
            ['content-type' => 'text/html; charset=utf-8'],
        ),
    ]);

    $response = getJson('/materials/content/parsed?url=https://example.com/content/unit/page.html');

    $response->assertOk();

    $data = $response->json();

    $expectedImageUrl = route('material.content', ['encodedUrl' => MaterialProxyUrl::encode('https://example.com/content/unit/images/cover.jpg')]);
    $expectedPlayerUrl = route('material.content', ['encodedUrl' => MaterialProxyUrl::encode('https://example.com/media/embed/player.html')]);

    expect($data['htmlContent'])->toContain($expectedImageUrl);
    expect($data['htmlContent'])->toContain($expectedPlayerUrl);
    expect($data['htmlContent'])->toContain('href="https://example.com/content/files/lesson.pdf"');
    expect($data['htmlContent'])->toContain('href="https://example.com/content/unit/page.html#section-2"');
    expect($data['htmlContent'])->toContain('target="_blank"');
    expect($data['htmlContent'])->toContain('noopener');
    expect($data['htmlContent'])->toContain('noreferrer');
});

it('sanitizes malformed utf-8 in parsed html response', function () {
    $invalidHtml = '<html><body><p>Bad '.chr(0xC3).chr(0x28).' bytes</p></body></html>';

    Http::fake([
        'https://example.com/content/bad.html' => Http::response(
            $invalidHtml,
            200,
            ['content-type' => 'text/html; charset=utf-8'],
        ),
    ]);

    $response = getJson('/materials/content/parsed?url=https://example.com/content/bad.html');

    $response->assertOk();

    $data = $response->json();

    expect($data['htmlContent'])->toContain('Bad');
    expect(mb_check_encoding($data['htmlContent'], 'UTF-8'))->toBeTrue();
});

it('converts big5 encoded html to utf-8', function () {
    $big5String = mb_convert_encoding('測試 Big5 內容', 'BIG-5', 'UTF-8');
    $invalidHtml = '<html><body><p>'.$big5String.'</p></body></html>';

    Http::fake([
        'https://example.com/content/big5.html' => Http::response(
            $invalidHtml,
            200,
            ['content-type' => 'text/html; charset=utf-8'],
        ),
    ]);

    $response = getJson('/materials/content/parsed?url=https://example.com/content/big5.html');

    $response->assertOk();

    $data = $response->json();

    expect($data['htmlContent'])->toContain('測試 Big5 內容');
    expect(mb_check_encoding($data['htmlContent'], 'UTF-8'))->toBeTrue();
});

it('proxies material content through the application', function () {
    Http::fake([
        'https://example.com/file.png' => Http::response(
            'PNGDATA',
            200,
            ['content-type' => 'image/png'],
        ),
    ]);

    $encoded = MaterialProxyUrl::encode('https://example.com/file.png');
    $response = get(route('material.content', ['encodedUrl' => $encoded]));

    $response->assertOk();
    $response->assertHeader('Content-Type', 'image/png');

    if (str_contains($_ENV['PHP_SELF'] ?? '', 'native.php')) {
        $response->assertHeader('X-Body-Encoding', 'base64');
        expect($response->getContent())->toBe(base64_encode('PNGDATA'));
    } else {
        $response->assertHeaderMissing('X-Body-Encoding');
        expect($response->getContent())->toBe('PNGDATA');
    }
});

it('redirects guest to login when session is missing', function () {
    app(UUSessionStore::class)->forget();

    $response = get('/materials/content/parsed?url=https://uu.nou.edu.tw/page.html');

    $response->assertRedirect('/login');
});
