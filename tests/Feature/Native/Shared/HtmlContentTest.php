<?php

declare(strict_types=1);

use App\NativeComponents\Support\HtmlColorScheme;
use App\NativeComponents\Support\HtmlContentDocument;
use App\NativeComponents\Support\HtmlLinkClassifier;
use Native\Mobile\Testing\TestableComponent;
use Tests\Feature\Native\Fixtures\RecordingHost;

/**
 * @return array<string, mixed>
 */
function findWebview(TestableComponent $host): array
{
    $found = null;
    $walk = function (array $node) use (&$walk, &$found): void {
        if (($node['type'] ?? null) === 'html_view') {
            $found = $node;
        }

        foreach ($node['children'] ?? [] as $child) {
            $walk($child);
        }
    };

    $walk($host->tree());

    expect($found)->not->toBeNull();

    return $found;
}

function tapLink(TestableComponent $host, string $url, string $scheme = 'https', bool $newWindow = false): TestableComponent
{
    return $host->fireEvent('onLinkTap', TestableComponent::EVENT_TEXT_CHANGE, [
        'text' => json_encode(['url' => $url, 'scheme' => $scheme, 'newWindow' => $newWindow], JSON_THROW_ON_ERROR),
    ]);
}

function postMessage(TestableComponent $host, array|string $payload): TestableComponent
{
    return $host->fireEvent('onMessage', TestableComponent::EVENT_TEXT_CHANGE, [
        'text' => is_string($payload) ? $payload : json_encode($payload, JSON_THROW_ON_ERROR),
    ]);
}

// ── Colour remap (port of htmlColorScheme.ts) ───────────────────────────────

it('remaps dark text colours to light ones in dark mode', function (): void {
    expect(HtmlColorScheme::adjustColourForDark('#000000', 'color'))->toBe('#f2f2f2')
        ->and(HtmlColorScheme::adjustColourForDark('#ffffff', 'color'))->toBe('#ffffff')
        ->and(HtmlColorScheme::adjustColourForDark('rgb(0, 0, 128)', 'color'))->toBe('#7f7fff');
});

it('remaps light backgrounds and borders to dark ones', function (): void {
    expect(HtmlColorScheme::adjustColourForDark('#ffffff', 'background-color'))->toBe('#0d0d0d')
        ->and(HtmlColorScheme::adjustColourForDark('#222222', 'background-color'))->toBe('#222222')
        ->and(HtmlColorScheme::adjustColourForDark('#eeeeee', 'border-color'))->toBe('#333333')
        ->and(HtmlColorScheme::adjustColourForDark('rgba(255, 255, 255, 0.5)', 'background-color'))->toBe('rgba(13, 13, 13, 0.5)');
});

it('leaves unparseable colours and unrelated properties alone', function (): void {
    expect(HtmlColorScheme::adjustColourForDark('red', 'color'))->toBe('red')
        ->and(HtmlColorScheme::adjustColourForDark('var(--x)', 'color'))->toBe('var(--x)')
        ->and(HtmlColorScheme::adjustStyleForDark('font-size: 12px; color: #000'))->toBe('font-size: 12px; color: #f2f2f2')
        ->and(HtmlColorScheme::adjustStyleForDark('margin: 0'))->toBe('margin: 0');
});

it('gives a background shorthand a readable text colour', function (): void {
    expect(HtmlColorScheme::adjustStyleForDark('background: #ffffff'))->toBe('background: #0d0d0d; color: #f2f2f2');
});

// ── Document building ───────────────────────────────────────────────────────

it('keeps Chinese text intact through the DOM round trip', function (): void {
    $document = HtmlContentDocument::build('<p style="color:#000">第一章：資料結構 ✓</p>', null, true, 1.0, [
        'text' => '#f4f4f5', 'link' => '#ffa282', 'border' => '#52525b', 'muted' => '#a1a1aa',
    ]);

    expect($document)->toContain('<p style="color: #f2f2f2">第一章：資料結構 ✓</p>')
        ->and($document)->toContain('<meta charset="utf-8">')
        ->and($document)->toContain('color-scheme:dark')
        ->and($document)->toContain('color:#f4f4f5');
});

it('leaves inline colours alone in light mode', function (): void {
    $document = HtmlContentDocument::build('<p style="color:#000">內容</p>', null, false, 1.0, [
        'text' => '#111', 'link' => '#222', 'border' => '#333', 'muted' => '#444',
    ]);

    expect($document)->toContain('<p style="color:#000">內容</p>')->and($document)->toContain('color-scheme:light');
});

it('absolutizes URLs, strips targets, scripts and handlers', function (): void {
    $document = HtmlContentDocument::build(
        '<a href="../b.html?x=1" target="_blank" onclick="x()">b</a><img src="/img/a.png"><a href="#top">t</a><a href="mailto:a@b.c">m</a><script>alert(1)</script>',
        'https://uu.nou.edu.tw/media/course/1/index.html',
        false,
        1.0,
        ['text' => '#111', 'link' => '#222', 'border' => '#333', 'muted' => '#444'],
    );

    expect($document)->toContain('href="https://uu.nou.edu.tw/media/course/b.html?x=1"')
        ->and($document)->toContain('src="https://uu.nou.edu.tw/img/a.png"')
        ->and($document)->toContain('href="#top"')
        ->and($document)->toContain('href="mailto:a@b.c"')
        ->and($document)->not->toContain('target=')
        ->and($document)->not->toContain('onclick')
        ->and($document)->not->toContain('alert(1)');
});

it('scales the base font size within the allowed range', function (): void {
    $colors = ['text' => '#111', 'link' => '#222', 'border' => '#333', 'muted' => '#444'];

    expect(HtmlContentDocument::build('x', null, false, 1.5, $colors))->toContain('font-size:24px')
        ->and(HtmlContentDocument::build('x', null, false, 9.0, $colors))->toContain('font-size:25.6px')
        ->and(HtmlContentDocument::build('x', null, false, 0.1, $colors))->toContain('font-size:11.2px');
});

it('resolves relative references like a browser', function (): void {
    $base = 'https://h.test/a/b/c.html?q=1';

    expect(HtmlContentDocument::absolutize('d.html', $base))->toBe('https://h.test/a/b/d.html')
        ->and(HtmlContentDocument::absolutize('../../d.html', $base))->toBe('https://h.test/d.html')
        ->and(HtmlContentDocument::absolutize('/x', $base))->toBe('https://h.test/x')
        ->and(HtmlContentDocument::absolutize('//cdn.test/x', $base))->toBe('https://cdn.test/x')
        ->and(HtmlContentDocument::absolutize('?p=2', $base))->toBe('https://h.test/a/b/c.html?p=2')
        ->and(HtmlContentDocument::absolutize('https://o.test/y', $base))->toBe('https://o.test/y')
        ->and(HtmlContentDocument::absolutize('rel', null))->toBe('rel');
});

// ── Link classification ─────────────────────────────────────────────────────

it('classifies links as node, subpage, tronclass or external in that order', function (): void {
    $nodes = [['identifier' => 'N2', 'href' => 'https://uu.nou.edu.tw/m/n2.html?x=1']];
    $active = 'https://uu.nou.edu.tw/m/index.html';

    expect(HtmlLinkClassifier::classify('https://uu.nou.edu.tw/m/n2.html?x=1', $nodes, $active)['kind'])->toBe('node')
        ->and(HtmlLinkClassifier::classify('https://uu.nou.edu.tw/m/n2.html?x=2', $nodes, $active)['kind'])->toBe('subpage')
        ->and(HtmlLinkClassifier::classify('https://tronclass.nou.edu.tw/x', $nodes, $active)['kind'])->toBe('tronclass')
        ->and(HtmlLinkClassifier::classify('https://example.com/', $nodes, $active)['kind'])->toBe('external')
        ->and(HtmlLinkClassifier::isInternalLoad('about:blank'))->toBeTrue()
        ->and(HtmlLinkClassifier::isInternalLoad('https://a.b'))->toBeFalse();
});

// ── Component ───────────────────────────────────────────────────────────────

it('renders a sandboxed html view with inline html and the link and height callbacks', function (): void {
    $host = RecordingHost::mountView('html-content', ['html' => '<p>第一章</p>']);
    $webview = findWebview($host);

    expect($webview['props']['html'])->toContain('<p>第一章</p>')
        ->and($webview['props'])->not->toHaveKeys(['javascript', 'dom_storage', 'src', 'auto_height', 'user_script', 'on_message'])
        ->and($webview['props'])->toHaveKeys(['on_link_tap', 'on_height_change']);
    $host->assertMissingElement('webview');
});

it('remaps colours only when the appearance is dark and forces the native scheme', function (): void {
    $html = '<p style="color:#000">x</p>';
    $light = findWebview(RecordingHost::mountView('html-content', ['html' => $html, 'appearance' => 'light']));
    $dark = findWebview(RecordingHost::mountView('html-content', ['html' => $html, 'appearance' => 'dark']));

    expect($light['props']['html'])->toContain('color:#000')
        ->and($light['props']['color_scheme'])->toBe('light')
        ->and($dark['props']['html'])->toContain('color: #f2f2f2')
        ->and($dark['props']['color_scheme'])->toBe('dark');
});

it('follows the device appearance by default', function (): void {
    $props = findWebview(RecordingHost::mountView('html-content', ['appearance' => 'auto']))['props'];

    expect($props)->not->toHaveKey('color_scheme');
});

it('sizes to its content only on request', function (): void {
    $fixed = findWebview(RecordingHost::mountView('html-content'));
    $auto = findWebview(RecordingHost::mountView('html-content', ['autoHeight' => true, 'estimatedHeight' => 96]));

    expect($fixed['props'])->not->toHaveKey('auto_height')
        ->and($fixed['layout'] ?? [])->not->toBe($auto['layout'] ?? [])
        ->and($auto['props']['auto_height'])->toBeTrue()
        ->and($auto['props']['estimated_height'])->toBe(96.0);
});

it('emits node-link with the node identifier and never reloads the content', function (): void {
    $host = RecordingHost::mountView('html-content');
    $before = findWebview($host)['props']['html'];

    tapLink($host, 'https://uu.nou.edu.tw/media/course/1/n2.html?x=1');

    expect($host->get('events'))->toBe([['node-link', 'N2', 'https://uu.nou.edu.tw/media/course/1/n2.html?x=1']])
        ->and(findWebview($host)['props']['html'])->toBe($before);
});

it('emits subpage, tronclass and external links', function (): void {
    $host = RecordingHost::mountView('html-content');

    tapLink($host, 'https://uu.nou.edu.tw/media/course/1/page2.html');
    tapLink($host, 'https://tronclass.nou.edu.tw/course/1');
    tapLink($host, 'https://example.com/', newWindow: true);

    expect($host->get('events'))->toBe([
        ['subpage-link', 'https://uu.nou.edu.tw/media/course/1/page2.html'],
        ['tronclass-link', 'https://tronclass.nou.edu.tw/course/1'],
        ['external-link', 'https://example.com/'],
    ]);
});

it('emits mailto and tel links and drops every other scheme', function (): void {
    $host = RecordingHost::mountView('html-content');

    tapLink($host, 'mailto:teacher@example.com', 'mailto');
    tapLink($host, 'tel:+886212345678', 'tel');
    tapLink($host, 'javascript:alert(1)', 'javascript');
    tapLink($host, 'intent://x#Intent;end', 'intent');

    expect($host->get('events'))->toBe([
        ['mailto-link', 'mailto:teacher@example.com'],
        ['tel-link', 'tel:+886212345678'],
    ]);
});

it('ignores internal urls and malformed payloads', function (): void {
    $host = RecordingHost::mountView('html-content');

    tapLink($host, 'about:blank', 'about');
    tapLink($host, 'data:text/html,hi', 'data');
    $host->fireEvent('onLinkTap', TestableComponent::EVENT_TEXT_CHANGE, ['text' => 'not json']);
    $host->fireEvent('onLinkTap', TestableComponent::EVENT_TEXT_CHANGE, ['text' => '{"scheme":"https"}']);

    expect($host->get('events'))->toBe([]);
});

it('forwards content height changes as floats', function (): void {
    $host = RecordingHost::mountView('html-content', ['autoHeight' => true]);

    $host->fireEvent('onHeight', TestableComponent::EVENT_TEXT_CHANGE, ['text' => '312.5']);
    $host->fireEvent('onHeight', TestableComponent::EVENT_TEXT_CHANGE, ['text' => 'garbage']);

    expect($host->get('events'))->toBe([['height', 312.5]]);
});

it('still accepts the retired autoRestore prop without reloading anything', function (): void {
    $host = RecordingHost::mountView('html-content', ['autoRestore' => false]);
    $before = findWebview($host)['props']['html'];

    tapLink($host, 'https://example.com/');

    expect(findWebview($host)['props']['html'])->toBe($before);
});

it('embeds YouTube with javascript on, the progress forwarder and a 16:9 stack', function (): void {
    $host = RecordingHost::mountView('html-embed', ['url' => 'https://www.youtube.com/embed/abc123']);
    $webview = findWebview($host);

    expect($webview['props']['src'])->toBe('https://www.youtube.com/embed/abc123')
        ->and($webview['props']['javascript'])->toBeTrue()
        ->and($webview['props']['dom_storage'])->toBeTrue()
        ->and($webview['props']['user_script'])->toContain('altuu-youtube-embed')->toContain('AltUUBridge.postMessage')
        ->and($webview['props'])->toHaveKeys(['on_link_tap', 'on_message'])
        ->and($webview['props'])->not->toHaveKey('html');
});

it('also embeds the statics youtube wrapper', function (): void {
    config(['services.statics.base_url' => 'https://statics.example.workers.dev']);

    $host = RecordingHost::mountView('html-embed', ['url' => 'https://statics.example.workers.dev/youtube-embed.html?v=dQw4w9WgXcQ']);

    expect(findWebview($host)['props']['src'])->toBe('https://statics.example.workers.dev/youtube-embed.html?v=dQw4w9WgXcQ');
});

it('refuses embed urls outside the allow-list', function (string $url): void {
    config(['services.statics.base_url' => 'https://statics.example.workers.dev']);

    $host = RecordingHost::mountView('html-embed', ['url' => $url]);

    $host->assertMissingElement('html_view');
})->with([
    'other host' => 'https://evil.example/embed/abc',
    'plain http' => 'http://www.youtube.com/embed/abc',
    'not an embed path' => 'https://www.youtube.com/watch?v=abc',
    'lookalike host' => 'https://www.youtube.com.evil.example/embed/abc',
    'statics host other page' => 'https://statics.example.workers.dev/other.html',
    'statics lookalike' => 'https://statics.example.workers.dev.evil.example/youtube-embed.html',
]);

it('emits the decoded message and the YouTube progress in embed mode', function (): void {
    $host = RecordingHost::mountView('html-embed', ['url' => 'https://www.youtube.com/embed/abc123']);

    postMessage($host, ['source' => 'altuu-youtube-embed', 'currentTime' => 12.5, 'duration' => 300]);
    postMessage($host, ['source' => 'altuu-youtube-embed', 'currentTime' => 13, 'duration' => 0]);
    postMessage($host, ['source' => 'other', 'currentTime' => 1]);
    postMessage($host, 'not json');

    expect($host->get('events'))->toBe([
        ['message', ['source' => 'altuu-youtube-embed', 'currentTime' => 12.5, 'duration' => 300]],
        ['progress', 12.5, 300.0],
        ['message', ['source' => 'altuu-youtube-embed', 'currentTime' => 13, 'duration' => 0]],
        ['progress', 13.0, null],
        ['message', ['source' => 'other', 'currentTime' => 1]],
    ]);
});

it('routes top-level link taps in embed mode to external-link', function (): void {
    $host = RecordingHost::mountView('html-embed', ['url' => 'https://www.youtube.com/embed/abc123']);

    tapLink($host, 'https://www.youtube.com/watch?v=abc123', newWindow: true);

    expect($host->get('events'))->toBe([['external-link', 'https://www.youtube.com/watch?v=abc123']]);
});
