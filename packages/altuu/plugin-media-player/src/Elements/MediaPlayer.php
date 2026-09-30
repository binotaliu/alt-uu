<?php

declare(strict_types=1);

namespace AltUU\MediaPlayer\Elements;

use Native\Mobile\Edge\CallbackRegistry;
use Native\Mobile\Edge\Element;

/**
 * `<native:media-player>`: the native audio/video player as an in-tree EDGE
 * element (AVPlayer + AVPlayerViewController on iOS, Media3 ExoPlayer +
 * PlayerView on Android). It is laid out by the screen like any other element
 * (no overlay frame coordinates) and drives one process-wide player, which the
 * bridge functions (`MediaPlayer.Play|Pause|Seek|SetPlaybackRate|GetState|
 * CaptureFrame`, see the `MediaPlayer` facade) control.
 *
 * Wire type: `media_player`. Props (only non-default values are emitted):
 *  - `src`             https media URL (video file, audio file or HLS)
 *  - `kind`            `video` (default, not emitted) | `audio`
 *  - `title`           material name (now-playing title, capture footer)
 *  - `course_name`     course name (now-playing album, capture footer)
 *  - `poster`          image URL shown until playback starts (video only)
 *  - `subtitles`       WebVTT URL, drawn by the player (video only)
 *  - `start`           float seconds, applied once per source load
 *  - `rate`            float 0.5..3.0, default 1.0; applied when the PROP changes,
 *                      never re-applied over a rate the user picked natively
 *  - `appearance`      `light` | `dark` (default: follow the device / theme)
 *  - `watermark`       text (student ID) that `CaptureFrame` stamps by default
 *  - `autoplay`        bool, default false
 *  - `session_context` JSON string (`routePath`,`cid`,`activityId`,`href`,`startedAt`),
 *                      echoed back by `MediaPlayer.GetState` for state restore
 *  - `on_progress`     callback id, text = JSON `{"currentTime","duration","state"}`
 *                      (about every 5 s while playing, plus on seek/pause/end)
 *  - `on_state_change` callback id, text = JSON `{"state","currentTime","duration"}`
 *                      with state `idle|buffering|playing|paused|ended`
 *  - `on_ended`        callback id, text = JSON `{"currentTime","duration"}`
 *  - `on_error`        callback id, text = JSON `{"message","code"}`
 *
 * Events are text (the only payload the EDGE wire carries) and are bound with
 * plain method-name attributes, like `native:html-view`:
 *
 *     <native:media-player src="{{ $url }}" on-progress="onProgress" on-ended="onEnded" />
 */
final class MediaPlayer extends Element
{
    public const float RATE_MIN = 0.5;

    public const float RATE_MAX = 3.0;

    public const array KINDS = ['video', 'audio'];

    public const array APPEARANCES = ['light', 'dark'];

    public const array CALLBACKS = ['on_progress', 'on_state_change', 'on_ended', 'on_error'];

    protected string $type = 'media_player';

    /** @var array<string, mixed> */
    protected array $viewProps = [];

    /** @var array<string, string> */
    protected array $callbackMethods = [];

    public static function make(): static
    {
        return new self;
    }

    /**
     * @param  array<string, mixed>  $attrs
     */
    public function applyAttributes(array $attrs): void
    {
        foreach (['src', 'title', 'course_name', 'poster', 'subtitles', 'watermark', 'session_context'] as $prop) {
            $value = $this->attribute($attrs, $prop);

            if ($value !== null && $value !== '') {
                $this->viewProps[$prop] = (string) $value;
            }
        }

        $kind = $this->attribute($attrs, 'kind');

        if ($kind === 'audio') {
            $this->viewProps['kind'] = 'audio';
        }

        $autoplay = $this->attribute($attrs, 'autoplay');

        if ($autoplay !== null && filter_var($autoplay === '' ? true : $autoplay, FILTER_VALIDATE_BOOLEAN)) {
            $this->viewProps['autoplay'] = true;
        }

        $start = $this->attribute($attrs, 'start');

        if (is_numeric($start) && (float) $start > 0.0) {
            $this->viewProps['start'] = (float) $start;
        }

        $rate = $this->attribute($attrs, 'rate');

        if (is_numeric($rate) && (float) $rate !== 1.0) {
            $this->viewProps['rate'] = max(self::RATE_MIN, min(self::RATE_MAX, (float) $rate));
        }

        $appearance = $this->attribute($attrs, 'appearance');

        if (is_string($appearance) && in_array($appearance, self::APPEARANCES, true)) {
            $this->viewProps['appearance'] = $appearance;
        }

        foreach (self::CALLBACKS as $callback) {
            $method = $this->attribute($attrs, $callback);

            if (is_string($method) && $method !== '') {
                $this->callbackMethods[$callback] = $method;
            }
        }

        $this->applyA11yAttributes($attrs);
    }

    /**
     * @return array<string, mixed>
     */
    protected function resolveProps(CallbackRegistry $registry): array
    {
        $props = $this->viewProps;

        foreach ($this->callbackMethods as $prop => $method) {
            $props[$prop] = $registry->register($method);
        }

        return $props;
    }

    /**
     * Reads an attribute by its snake_case name, accepting the kebab-case and
     * camelCase spellings Blade authors use (`course-name`, `courseName`).
     *
     * @param  array<string, mixed>  $attrs
     */
    private function attribute(array $attrs, string $snake): mixed
    {
        $kebab = str_replace('_', '-', $snake);
        $camel = lcfirst(str_replace(' ', '', ucwords(str_replace('_', ' ', $snake))));

        foreach ([$snake, $kebab, $camel] as $key) {
            if (array_key_exists($key, $attrs)) {
                return $attrs[$key];
            }
        }

        return null;
    }
}
