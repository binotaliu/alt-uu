<?php

declare(strict_types=1);

namespace AltUU\MediaPlayer\Facades;

use Illuminate\Support\Facades\Facade;

/**
 * @method static object|null play()
 * @method static object|null pause()
 * @method static object|null stop(?string $expectedUrl = null)
 * @method static object|null seek(float $seconds)
 * @method static float getCurrentTime()
 * @method static float getDuration()
 * @method static object|null setPlaybackRate(float $rate)
 * @method static float getPlaybackRate()
 * @method static object|null getState()
 * @method static object|null setAccent(string $accent)
 * @method static object|null captureFrame(?string $studentId = null, ?string $courseName = null, ?string $materialName = null)
 *
 * @see \AltUU\MediaPlayer\MediaPlayer
 */
final class MediaPlayer extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return \AltUU\MediaPlayer\MediaPlayer::class;
    }
}
