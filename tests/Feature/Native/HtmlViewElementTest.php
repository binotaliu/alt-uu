<?php

declare(strict_types=1);

use Native\Mobile\Edge\ElementRegistry;
use Native\Mobile\Testing\TestableComponent;
use Tests\Feature\Native\Fixtures\RecordingHost;

/**
 * @return array<string, mixed>
 */
function findHtmlView(TestableComponent $host): array
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

it('resolves the plugin element type from the manifest', function (): void {
    expect(ElementRegistry::has('html_view'))->toBeTrue();
});

it('renders inline html with only the props that differ from the defaults', function (): void {
    $props = findHtmlView(RecordingHost::mountView('html-view', ['html' => '<p>第一章</p>']))['props'];

    expect($props['html'])->toBe('<p>第一章</p>')
        ->and($props)->not->toHaveKeys(['src', 'javascript', 'dom_storage', 'auto_height', 'color_scheme', 'font_scale', 'user_script']);
});

it('emits the sizing, appearance and script props', function (): void {
    $props = findHtmlView(RecordingHost::mountView('html-view', [
        'javascript' => true,
        'autoHeight' => true,
        'estimatedHeight' => 120,
        'colorScheme' => 'dark',
        'fontScale' => 1.25,
        'userScript' => 'window.x = 1;',
    ]))['props'];

    expect($props['javascript'])->toBeTrue()
        ->and($props['auto_height'])->toBeTrue()
        ->and($props['estimated_height'])->toBe(120.0)
        ->and($props['color_scheme'])->toBe('dark')
        ->and($props['font_scale'])->toBe(1.25)
        ->and($props['user_script'])->toBe('window.x = 1;');
});

it('clamps the font scale and ignores unknown colour schemes', function (): void {
    $props = findHtmlView(RecordingHost::mountView('html-view', ['fontScale' => 9, 'colorScheme' => 'sepia']))['props'];

    expect($props['font_scale'])->toBe(3.0)->and($props)->not->toHaveKey('color_scheme');
});

it('loads a url instead of inline html', function (): void {
    $props = findHtmlView(RecordingHost::mountView('html-view', ['html' => '', 'src' => 'https://uu.nou.edu.tw/x']))['props'];

    expect($props['src'])->toBe('https://uu.nou.edu.tw/x')->and($props)->not->toHaveKey('html');
});

it('registers one callback id per bound event', function (): void {
    $props = findHtmlView(RecordingHost::mountView('html-view'))['props'];

    expect($props['on_link_tap'])->toBeInt()->toBeGreaterThan(0)
        ->and($props['on_height_change'])->toBeInt()->toBeGreaterThan(0)
        ->and($props['on_message'])->toBeInt()->toBeGreaterThan(0)
        ->and(count(array_unique([$props['on_link_tap'], $props['on_height_change'], $props['on_message']])))->toBe(3);
});

it('delivers each native text event to the bound method with the text appended', function (): void {
    $host = RecordingHost::mountView('html-view');

    $host->fireEvent("record('link-tap')", TestableComponent::EVENT_TEXT_CHANGE, ['text' => '{"url":"https://a.b/","scheme":"https","newWindow":false}'])
        ->fireEvent("record('height')", TestableComponent::EVENT_TEXT_CHANGE, ['text' => '312.5'])
        ->fireEvent("record('message')", TestableComponent::EVENT_TEXT_CHANGE, ['text' => '{"source":"altuu-youtube-embed","currentTime":4}']);

    expect($host->get('events'))->toBe([
        ['link-tap', '{"url":"https://a.b/","scheme":"https","newWindow":false}'],
        ['height', '312.5'],
        ['message', '{"source":"altuu-youtube-embed","currentTime":4}'],
    ]);
});
