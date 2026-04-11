<?php

declare(strict_types=1);

namespace AltUU\MediaPlayer;

final class MediaPlayer
{
    /**
     * Set the media player with URL and display frame.
     *
     * @param  string  $url  The media URL (audio or video)
     * @param  string  $type  The media type: 'audio' or 'video'
     * @param  array  $frame  The display frame [x, y, width, height] in points
     */
    public function setPlayer(string $url, string $type, array $frame, ?string $courseName = null, ?string $materialName = null): ?object
    {
        $payload = [
            'url' => $url,
            'type' => $type,
            'frame' => [
                'x' => $frame[0] ?? 0,
                'y' => $frame[1] ?? 0,
                'width' => $frame[2] ?? 320,
                'height' => $frame[3] ?? 200,
            ],
        ];

        if ($courseName !== null) {
            $payload['courseName'] = $courseName;
        }

        if ($materialName !== null) {
            $payload['materialName'] = $materialName;
        }

        return $this->call('MediaPlayer.SetPlayer', $payload);
    }

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
     * Stop the current media and clear.
     */
    public function stop(): ?object
    {
        return $this->call('MediaPlayer.Stop');
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
