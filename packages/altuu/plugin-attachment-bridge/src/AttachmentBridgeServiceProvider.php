<?php

declare(strict_types=1);

namespace AltUU\AttachmentBridge;

use Illuminate\Support\ServiceProvider;

final class AttachmentBridgeServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(AttachmentBridge::class, function () {
            return new AttachmentBridge;
        });
    }
}
