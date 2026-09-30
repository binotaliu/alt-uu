<?php

declare(strict_types=1);

use Native\Mobile\Edge\ElementRegistry;
use Native\Mobile\Testing\TestableComponent;
use Tests\Feature\Native\Fixtures\RecordingHost;

/**
 * @return array<string, mixed>
 */
function findMediaPlayer(TestableComponent $host): array
{
    $found = null;
    $walk = function (array $node) use (&$walk, &$found): void {
        if (($node['type'] ?? null) === 'media_player') {
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
    expect(ElementRegistry::has('media_player'))->toBeTrue();
});

it('emits only src for a default video player', function (): void {
    $props = findMediaPlayer(RecordingHost::mountView('media-player', ['src' => 'https://uu.nou.edu.tw/a.mp4']))['props'];

    expect($props['src'])->toBe('https://uu.nou.edu.tw/a.mp4')
        ->and($props)->not->toHaveKeys(['kind', 'title', 'course_name', 'poster', 'subtitles', 'start', 'rate', 'appearance', 'watermark', 'autoplay', 'session_context']);
});

it('emits the full prop set with snake_case names', function (): void {
    $props = findMediaPlayer(RecordingHost::mountView('media-player', [
        'src' => 'https://uu.nou.edu.tw/a.mp3',
        'kind' => 'audio',
        'title' => '第一章',
        'courseName' => '資料結構',
        'poster' => 'https://uu.nou.edu.tw/p.jpg',
        'subtitles' => 'https://uu.nou.edu.tw/s.vtt',
        'start' => 42.5,
        'rate' => 1.5,
        'appearance' => 'dark',
        'watermark' => 'A1234567',
        'autoplay' => true,
        'sessionContext' => '{"cid":"9"}',
    ]))['props'];

    expect($props)->toMatchArray([
        'kind' => 'audio',
        'title' => '第一章',
        'course_name' => '資料結構',
        'poster' => 'https://uu.nou.edu.tw/p.jpg',
        'subtitles' => 'https://uu.nou.edu.tw/s.vtt',
        'start' => 42.5,
        'rate' => 1.5,
        'appearance' => 'dark',
        'watermark' => 'A1234567',
        'autoplay' => true,
        'session_context' => '{"cid":"9"}',
    ]);
});

it('clamps the rate and ignores unknown kinds, appearances and non-positive starts', function (): void {
    $props = findMediaPlayer(RecordingHost::mountView('media-player', [
        'src' => 'x', 'rate' => 9, 'kind' => 'gif', 'appearance' => 'sepia', 'start' => 0,
    ]))['props'];

    expect($props['rate'])->toBe(3.0)->and($props)->not->toHaveKeys(['kind', 'appearance', 'start']);

    expect(findMediaPlayer(RecordingHost::mountView('media-player', ['src' => 'x', 'rate' => 0.1]))['props']['rate'])->toBe(0.5)
        ->and(findMediaPlayer(RecordingHost::mountView('media-player', ['src' => 'x', 'rate' => 1]))['props'])->not->toHaveKey('rate');
});

it('registers one distinct callback id per bound event', function (): void {
    $props = findMediaPlayer(RecordingHost::mountView('media-player', ['src' => 'x']))['props'];
    $ids = [$props['on_progress'], $props['on_state_change'], $props['on_ended'], $props['on_error']];

    expect($ids)->each->toBeInt();
    expect(min($ids))->toBeGreaterThan(0)
        ->and(count(array_unique($ids)))->toBe(4);
});

it('delivers each native text event to the bound method with the json appended', function (): void {
    $host = RecordingHost::mountView('media-player', ['src' => 'x']);

    $host->fireEvent("record('progress')", TestableComponent::EVENT_TEXT_CHANGE, ['text' => '{"currentTime":5,"duration":60,"state":"playing"}'])
        ->fireEvent("record('state')", TestableComponent::EVENT_TEXT_CHANGE, ['text' => '{"state":"paused"}'])
        ->fireEvent("record('ended')", TestableComponent::EVENT_TEXT_CHANGE, ['text' => '{"currentTime":60,"duration":60}'])
        ->fireEvent("record('error')", TestableComponent::EVENT_TEXT_CHANGE, ['text' => '{"message":"boom"}']);

    expect($host->get('events'))->toBe([
        ['progress', '{"currentTime":5,"duration":60,"state":"playing"}'],
        ['state', '{"state":"paused"}'],
        ['ended', '{"currentTime":60,"duration":60}'],
        ['error', '{"message":"boom"}'],
    ]);
});
