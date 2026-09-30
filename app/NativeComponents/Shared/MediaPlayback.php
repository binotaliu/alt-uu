<?php

declare(strict_types=1);

namespace App\NativeComponents\Shared;

use AltUU\MediaPlayer\Facades\MediaPlayer;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * Host for the native audio/video player inside a native screen. It renders
 * the in-repo `altuu/plugin-media-player` element (`<native:media-player>`)
 * and turns its text/JSON events into typed component events. It is called
 * `media-playback` (not `media-player`) because a registered element name
 * always wins over a component tag of the same name.
 *
 * Tag:
 *   `<native:media-playback key="video-{{ $node->id }}" src="{{ $url }}" kind="video" title="{{ $title }}" course-name="{{ $course }}" :start="$resume" :rate="$rate" appearance="auto" watermark="{{ $studentId }}" :autoplay="true" :session-context="$context" @progress="onProgress" @ended="onEnded" @error="onPlayerError" />`
 *
 * Props:
 *  - `src` (string) media URL; the player reloads only when `src` or `kind` changes.
 *  - `kind` (`video` default | `audio`).
 *  - `title` (string) material name, `courseName` (string) course name (now-playing
 *    metadata and the frame-capture footer).
 *  - `poster` (?string) image URL shown until playback starts (video).
 *  - `subtitles` (?string) WebVTT URL (video).
 *  - `start` (float seconds, default 0) resume position, applied once per source load.
 *  - `rate` (float, default 1.0) applied when this prop changes; a rate the user
 *    picks in the native controls is NOT reset by later renders.
 *  - `appearance` (`auto` default = device/theme, `light`, `dark`). Pass the
 *    resolved `GetAppearance` value (`system` -> `auto`).
 *  - `watermark` (?string) student ID stamped on captured frames by
 *    `MediaPlayer::captureFrame()`.
 *  - `autoplay` (bool, default false).
 *  - `sessionContext` (?array{routePath?:string,cid?:string,activityId?:string,href?:string,startedAt?:string})
 *    echoed back by `MediaPlayer::getState()` so a screen can restore itself.
 *  - `playerClass` (?string) size classes; default `w-full aspect-video` (video) or `w-full h-24` (audio).
 *
 * Events (argument order is fixed):
 *  - `progress` (`float $currentTime`, `?float $duration`, `string $state`)  about every 5 s
 *    while playing, plus on seek, pause and end. Feed the study timer with it.
 *  - `state-changed` (`string $state`, `float $currentTime`, `?float $duration`)  state is
 *    `idle|buffering|playing|paused|ended`.
 *  - `ended` (`float $currentTime`, `?float $duration`)
 *  - `error` (`string $message`, `?int $code`)
 *
 * Imperative control goes through the facade (`MediaPlayer::seek()`, `pause()`,
 * `setPlaybackRate()`, `getState()`, `captureFrame()`); `unmount()` stops the
 * player, guarded by the source URL so a late stop cannot kill a newer player.
 */
final class MediaPlayback extends NativeComponent
{
    public string $src = '';

    public string $kind = 'video';

    public string $title = '';

    public string $courseName = '';

    public ?string $poster = null;

    public ?string $subtitles = null;

    public float $start = 0.0;

    public float $rate = 1.0;

    public string $appearance = 'auto';

    public ?string $watermark = null;

    public bool $autoplay = false;

    /** @var array<string, mixed>|null */
    public ?array $sessionContext = null;

    public ?string $playerClass = null;

    public function unmount(): void
    {
        if ($this->src !== '') {
            MediaPlayer::stop($this->src);
        }
    }

    /**
     * Native `on-progress` handler. Receives JSON `{"currentTime","duration","state"}`.
     */
    public function onProgress(string $payload): void
    {
        $data = $this->decode($payload);

        if ($data === null) {
            return;
        }

        $this->emit('progress', $this->seconds($data['currentTime'] ?? null) ?? 0.0, $this->positive($data['duration'] ?? null), $this->state($data));
    }

    /**
     * Native `on-state-change` handler. Receives JSON `{"state","currentTime","duration"}`.
     */
    public function onStateChange(string $payload): void
    {
        $data = $this->decode($payload);

        if ($data === null) {
            return;
        }

        $this->emit('state-changed', $this->state($data), $this->seconds($data['currentTime'] ?? null) ?? 0.0, $this->positive($data['duration'] ?? null));
    }

    /**
     * Native `on-ended` handler. Receives JSON `{"currentTime","duration"}`.
     */
    public function onEnded(string $payload): void
    {
        $data = $this->decode($payload) ?? [];

        $this->emit('ended', $this->seconds($data['currentTime'] ?? null) ?? 0.0, $this->positive($data['duration'] ?? null));
    }

    /**
     * Native `on-error` handler. Receives JSON `{"message","code"}`.
     */
    public function onError(string $payload): void
    {
        $data = $this->decode($payload) ?? [];

        $message = is_string($data['message'] ?? null) && $data['message'] !== '' ? $data['message'] : '播放發生錯誤';
        $code = is_numeric($data['code'] ?? null) ? (int) $data['code'] : null;

        $this->emit('error', $message, $code);
    }

    public function render(): View
    {
        $isAudio = $this->kind === 'audio';

        return view('native.shared.media-playback', [
            'kind' => $isAudio ? 'audio' : 'video',
            'playerClass' => $this->playerClass ?? ($isAudio ? 'w-full h-24' : 'w-full aspect-video'),
            'appearanceValue' => in_array($this->appearance, ['light', 'dark'], true) ? $this->appearance : null,
            'sessionContextJson' => $this->sessionContext === null || $this->sessionContext === []
                ? null
                : json_encode($this->sessionContext, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function decode(string $payload): ?array
    {
        $data = json_decode($payload, true);

        return is_array($data) ? $data : null;
    }

    private function seconds(mixed $value): ?float
    {
        return is_numeric($value) && is_finite((float) $value) ? max(0.0, (float) $value) : null;
    }

    private function positive(mixed $value): ?float
    {
        $seconds = $this->seconds($value);

        return $seconds !== null && $seconds > 0.0 ? $seconds : null;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function state(array $data): string
    {
        $state = $data['state'] ?? null;

        return is_string($state) && in_array($state, ['idle', 'buffering', 'playing', 'paused', 'ended'], true) ? $state : 'idle';
    }
}
