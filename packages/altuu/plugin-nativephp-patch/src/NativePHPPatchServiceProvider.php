<?php

declare(strict_types=1);

namespace AltUU\NativePHPPatch;

use AltUU\NativePHPPatch\Commands\ApplyNativeShellPatchCommand;
use AltUU\NativePHPPatch\Commands\GenerateNativeShellPatchDiffCommand;
use AltUU\NativePHPPatch\Commands\VerifyNativeShellPatchCommand;
use Illuminate\Support\ServiceProvider;

final class NativePHPPatchServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([
                ApplyNativeShellPatchCommand::class,
                VerifyNativeShellPatchCommand::class,
                GenerateNativeShellPatchDiffCommand::class,
            ]);
        }
    }
}
