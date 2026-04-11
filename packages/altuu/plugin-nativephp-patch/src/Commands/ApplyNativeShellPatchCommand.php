<?php

declare(strict_types=1);

namespace AltUU\NativePHPPatch\Commands;

use AltUU\NativePHPPatch\PatchMap;
use Illuminate\Support\Facades\File;
use Native\Mobile\Plugins\Commands\NativePluginHookCommand;

final class ApplyNativeShellPatchCommand extends NativePluginHookCommand
{
    protected $signature = 'nativephp:nativephp-patch:apply';

    protected $description = 'Apply hash-verified NativePHP shell patches using full-file replacement';

    public function handle(): int
    {
        if ($this->isIos()) {
            return $this->applyPlatformPatches('ios', $this->resolveBuildPath('ios'));
        }

        if ($this->isAndroid()) {
            return $this->applyPlatformPatches('android', $this->resolveBuildPath('android'));
        }

        $this->line('[nativephp-patch] Skipping unsupported platform.');

        return self::SUCCESS;
    }

    private function applyPlatformPatches(string $platform, string $buildPath): int
    {
        foreach (PatchMap::forPlatform($platform) as $patch) {
            if (! $this->applySinglePatch($buildPath, $patch)) {
                return self::FAILURE;
            }
        }

        $this->info("[nativephp-patch] {$platform} patches applied successfully.");

        return self::SUCCESS;
    }

    /**
     * @param  array{target: string, upstream: string, upstream_hash: string, patched: string, patched_hash: string}  $patch
     */
    private function applySinglePatch(string $buildPath, array $patch): bool
    {
        $targetPath = $buildPath.'/'.$patch['target'];

        if (! File::exists($targetPath)) {
            $this->warn("[nativephp-patch] Target file not found: {$targetPath}");

            return false;
        }

        $patchedTemplatePath = base_path($patch['patched']);

        if (! File::exists($patchedTemplatePath)) {
            $this->warn("[nativephp-patch] Patched template missing: {$patchedTemplatePath}");

            return false;
        }

        if ($this->sha256($patchedTemplatePath) !== $patch['patched_hash']) {
            $this->warn("[nativephp-patch] Patched template hash mismatch: {$patchedTemplatePath}");

            return false;
        }

        $currentHash = $this->sha256($targetPath);

        if ($currentHash === $patch['patched_hash']) {
            $this->line("[nativephp-patch] Already patched: {$patch['target']}");

            return true;
        }

        if ($currentHash !== $patch['upstream_hash']) {
            $this->warn("[nativephp-patch] Upstream hash mismatch for {$patch['target']}.");
            $this->warn('[nativephp-patch] Refusing to overwrite because the file does not match vendor baseline.');

            return false;
        }

        File::put($targetPath, File::get($patchedTemplatePath));

        if ($this->sha256($targetPath) !== $patch['patched_hash']) {
            $this->warn("[nativephp-patch] Post-write hash verification failed for {$patch['target']}.");

            return false;
        }

        $this->info("[nativephp-patch] Patched {$patch['target']}");

        return true;
    }

    private function resolveBuildPath(string $platform): string
    {
        $buildPath = trim((string) $this->option('build-path'));

        if ($buildPath !== '') {
            return rtrim($buildPath, '/');
        }

        return $platform === 'ios' ? 'nativephp/ios' : 'nativephp/android';
    }

    private function sha256(string $path): string
    {
        $hash = hash_file('sha256', $path);

        return $hash === false ? '' : $hash;
    }
}
