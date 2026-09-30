<?php

declare(strict_types=1);

namespace AltUU\MediaPlayer;

/**
 * Bridge control for the process-wide native player that
 * `<native:media-player>` (see Elements\MediaPlayer) drives. The element owns
 * source, start position, rate and autoplay through its props; use this facade
 * for imperative control (seek from the material directory, stop on unmount,
 * frame capture).
 */
final class MediaPlayer
{
    /**
     * Play the current media.
     */
    public function play(): ?object
    {
        return $this->call('MediaPlayer.Play');
    }

    /**
     * Pause the current media.
     */
    public function pause(): ?object
    {
        return $this->call('MediaPlayer.Pause');
    }

    /**
     * Stop and release the player.
     *
     * @param  string|null  $expectedUrl  Ignored natively when a newer source has replaced this one
     *                                    (a late stop must not tear down the new player)
     */
    public function stop(?string $expectedUrl = null): ?object
    {
        return $this->call('MediaPlayer.Stop', $expectedUrl !== null ? ['url' => $expectedUrl] : []);
    }

    /**
     * Seek to a specific time.
     *
     * @param  float  $seconds  The time in seconds
     */
    public function seek(float $seconds): ?object
    {
        return $this->call('MediaPlayer.Seek', [
            'time' => $seconds,
        ]);
    }

    /**
     * Get the current playback position in seconds.
     */
    public function getCurrentTime(): float
    {
        $result = $this->call('MediaPlayer.GetCurrentTime');

        return (float) ($result->time ?? 0);
    }

    /**
     * Get the media duration in seconds (0 when unknown).
     */
    public function getDuration(): float
    {
        $result = $this->call('MediaPlayer.GetCurrentTime');

        return (float) ($result->duration ?? 0);
    }

    /**
     * Set the playback rate (0.5..3.0).
     */
    public function setPlaybackRate(float $rate): ?object
    {
        return $this->call('MediaPlayer.SetPlaybackRate', ['rate' => $rate]);
    }

    public function getPlaybackRate(): float
    {
        $result = $this->call('MediaPlayer.GetPlaybackRate');

        return (float) ($result->rate ?? 1.0);
    }

    /**
     * Player state for restoring a screen: `isActive`, `url`, `type`,
     * `currentTime`, `duration`, `state`, `playbackRate` and the element's
     * `sessionContext`. Null when there is no native runtime.
     */
    public function getState(): ?object
    {
        return $this->call('MediaPlayer.GetState');
    }

    /**
     * Capture the current video frame, stamp the watermark and footer, and
     * open the share sheet.
     *
     * @param  string|null  $studentId  Watermark text; defaults to the element's `watermark` prop
     * @param  string|null  $courseName  Footer course; defaults to the element's `course-name`
     * @param  string|null  $materialName  Footer material; defaults to the element's `title`
     */
    public function captureFrame(?string $studentId = null, ?string $courseName = null, ?string $materialName = null): ?object
    {
        return $this->call('MediaPlayer.CaptureFrame', array_filter([
            'studentId' => $studentId,
            'courseName' => $courseName,
            'materialName' => $materialName,
        ], static fn (?string $value): bool => $value !== null && $value !== ''));
    }

    /**
     * @param  array<string, mixed>  $parameters
     */
    private function call(string $method, array $parameters = []): ?object
    {
        if (! function_exists('nativephp_call')) {
            return null;
        }

        $result = nativephp_call($method, json_encode($parameters));

        if (! $result) {
            return null;
        }

        $decoded = json_decode($result);

        return $decoded->data ?? null;
    }
}
