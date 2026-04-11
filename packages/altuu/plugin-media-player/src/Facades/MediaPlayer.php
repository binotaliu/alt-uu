<?php

declare(strict_types=1);

namespace AltUU\MediaPlayer\Facades;

use Illuminate\Support\Facades\Facade;

/**
 * @method static object|null setPlayer(string $url, string $type, array $frame)
 * @method static object|null play()
 * @method static object|null pause()
 * @method static object|null stop()
 * @method static object|null seek(float $seconds)
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
