<?php

declare(strict_types=1);

namespace AltUU\MediaPlayer;

use Illuminate\Support\ServiceProvider;

final class MediaPlayerServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(MediaPlayer::class, function () {
            return new MediaPlayer;
        });
    }

    public function boot(): void
    {
        // Bridge-only plugin; NativePHP shell patching is handled by altuu/plugin-nativephp-patch.
    }
}
