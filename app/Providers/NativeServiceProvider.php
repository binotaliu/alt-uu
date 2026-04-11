<?php

declare(strict_types=1);

namespace App\Providers;

use AltUU\AttachmentBridge\AttachmentBridgeServiceProvider;
use AltUU\MediaPlayer\MediaPlayerServiceProvider;
use AltUU\NativePHPPatch\NativePHPPatchServiceProvider;
use Illuminate\Support\ServiceProvider;
use Native\Mobile\Providers\BrowserServiceProvider;
use Native\Mobile\Providers\DeviceServiceProvider;
use Native\Mobile\Providers\SystemServiceProvider;

final class NativeServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        //
    }

    /**
     * The NativePHP plugins to enable.
     *
     * Only plugins listed here will be compiled into your native builds.
     * This is a security measure to prevent transitive dependencies from
     * automatically registering plugins without your explicit consent.
     *
     * @return array<int, class-string<ServiceProvider>>
     */
    public function plugins(): array
    {
        return [
            SystemServiceProvider::class,
            AttachmentBridgeServiceProvider::class,
            NativePHPPatchServiceProvider::class,
            BrowserServiceProvider::class,
            MediaPlayerServiceProvider::class,
            DeviceServiceProvider::class,
        ];
    }
}
