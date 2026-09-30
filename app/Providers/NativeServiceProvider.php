<?php

declare(strict_types=1);

namespace App\Providers;

use AltUU\AltUUPlus\AltUUPlus;
use AltUU\AltUUPlus\AltUUPlusServiceProvider;
use AltUU\AttachmentBridge\AttachmentBridgeServiceProvider;
use AltUU\MediaPlayer\MediaPlayerServiceProvider;
use AltUU\NativePHPPatch\NativePHPPatchServiceProvider;
use App\Services\LocalAltUUPlus;
use Illuminate\Support\ServiceProvider;
use Native\Mobile\Facades\System;
use Native\Mobile\Providers\BrowserServiceProvider;
use Native\Mobile\Providers\DeviceServiceProvider;
use Native\Mobile\Providers\NetworkServiceProvider;
use Native\Mobile\UI\NativeUIServiceProvider;

final class NativeServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        // The native IAP bridge (StoreKit/Play Billing) is only reachable
        // from a compiled NativePHP shell or a Jump-connected device, so it
        // has no product data when developing against the web build (e.g.
        // Herd). Swap in a local fake there so the subscription UI has
        // something to render.
        if (! System::isMobile()) {
            $this->app->singleton(AltUUPlus::class, fn (): AltUUPlus => new LocalAltUUPlus);
        }
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
            AttachmentBridgeServiceProvider::class,
            NativePHPPatchServiceProvider::class,
            BrowserServiceProvider::class,
            MediaPlayerServiceProvider::class,
            DeviceServiceProvider::class,
            AltUUPlusServiceProvider::class,
            NetworkServiceProvider::class,
            NativeUIServiceProvider::class,
        ];
    }
}
