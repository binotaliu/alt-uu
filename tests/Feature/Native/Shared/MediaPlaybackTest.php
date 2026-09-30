<?php

declare(strict_types=1);

use Native\Mobile\Testing\TestableComponent;
use Tests\Feature\Native\Fixtures\RecordingHost;

/**
 * @return array<string, mixed>
 */
function findPlaybackElement(TestableComponent $host): array
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

function playbackEvent(TestableComponent $host, string $method, array $payload): TestableComponent
{
    return $host->fireEvent($method, TestableComponent::EVENT_TEXT_CHANGE, ['text' => json_encode($payload, JSON_THROW_ON_ERROR)]);
}

it('renders a video element with the default sizing and no optional props', function (): void {
    $node = findPlaybackElement(RecordingHost::mountView('media-playback'));

    expect($node['props']['src'])->toBe('https://uu.nou.edu.tw/media/a.mp4')
        ->and($node['props'])->not->toHaveKeys(['kind', 'appearance', 'autoplay', 'start', 'rate', 'session_context']);
});

it('maps the props onto the element', function (): void {
    $props = findPlaybackElement(RecordingHost::mountView('media-playback', [
        'kind' => 'audio',
        'title' => '第一章',
        'courseName' => '資料結構',
        'poster' => 'https://uu.nou.edu.tw/p.jpg',
        'subtitles' => 'https://uu.nou.edu.tw/s.vtt',
        'start' => 90,
        'rate' => 1.25,
        'appearance' => 'light',
        'watermark' => 'A1234567',
        'autoplay' => true,
        'sessionContext' => ['cid' => '9', 'routePath' => '/courses/9/material'],
    ]))['props'];

    expect($props)->toMatchArray([
        'kind' => 'audio',
        'title' => '第一章',
        'course_name' => '資料結構',
        'poster' => 'https://uu.nou.edu.tw/p.jpg',
        'subtitles' => 'https://uu.nou.edu.tw/s.vtt',
        'start' => 90.0,
        'rate' => 1.25,
        'appearance' => 'light',
        'watermark' => 'A1234567',
        'autoplay' => true,
    ])->and(json_decode($props['session_context'], true))->toBe(['cid' => '9', 'routePath' => '/courses/9/material']);
});

it('treats appearance auto as follow-the-device', function (): void {
    expect(findPlaybackElement(RecordingHost::mountView('media-playback', ['appearance' => 'auto']))['props'])->not->toHaveKey('appearance');
});

it('emits progress with typed arguments', function (): void {
    $host = playbackEvent(RecordingHost::mountView('media-playback'), 'onProgress', ['currentTime' => 12.5, 'duration' => 300, 'state' => 'playing']);

    expect($host->get('events'))->toBe([['progress', 12.5, 300.0, 'playing']]);
});

it('normalises unknown state, unknown duration and bad numbers in progress', function (): void {
    $host = RecordingHost::mountView('media-playback');
    playbackEvent($host, 'onProgress', ['currentTime' => 'x', 'duration' => 0, 'state' => 'weird']);

    expect($host->get('events'))->toBe([['progress', 0.0, null, 'idle']]);
});

it('ignores a progress payload that is not json', function (): void {
    $host = RecordingHost::mountView('media-playback')
        ->fireEvent('onProgress', TestableComponent::EVENT_TEXT_CHANGE, ['text' => 'not json']);

    expect($host->get('events'))->toBe([]);
});

it('emits state changes, end and error', function (): void {
    $host = RecordingHost::mountView('media-playback');
    playbackEvent($host, 'onStateChange', ['state' => 'buffering', 'currentTime' => 3, 'duration' => 0]);
    playbackEvent($host, 'onEnded', ['currentTime' => 300, 'duration' => 300]);
    playbackEvent($host, 'onError', ['message' => '無法載入', 'code' => 2001]);
    playbackEvent($host, 'onError', []);

    expect($host->get('events'))->toBe([
        ['state-changed', 'buffering', 3.0, null],
        ['ended', 300.0, 300.0],
        ['error', '無法載入', 2001],
        ['error', '播放發生錯誤', null],
    ]);
});
