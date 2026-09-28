<?php

declare(strict_types=1);

namespace AltUU\AltUUPlus;

use AltUU\AltUUPlus\Commands\PreCompileCommand;
use Illuminate\Support\ServiceProvider;

final class AltUUPlusServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(AltUUPlus::class, function () {
            return new AltUUPlus;
        });
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([
                PreCompileCommand::class,
            ]);
        }
    }
}
