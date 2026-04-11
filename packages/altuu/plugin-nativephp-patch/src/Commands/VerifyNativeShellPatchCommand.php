<?php

declare(strict_types=1);

namespace AltUU\NativePHPPatch\Commands;

use AltUU\NativePHPPatch\PatchMap;
use Illuminate\Support\Facades\File;
use Native\Mobile\Plugins\Commands\NativePluginHookCommand;

final class VerifyNativeShellPatchCommand extends NativePluginHookCommand
{
    protected $signature = 'nativephp:nativephp-patch:verify {--vendor-path= : Base vendor/nativephp/mobile path to validate}';

    protected $description = 'Verify vendor/nativephp/mobile upstream files against expected baseline hashes.';

    public function handle(): int
    {
        if ($this->isIos()) {
            return $this->verifyPlatformUpstream('ios', $this->resolveVendorPath());
        }

        if ($this->isAndroid()) {
            return $this->verifyPlatformUpstream('android', $this->resolveVendorPath());
        }

        $this->line('[nativephp-patch] Skipping unsupported platform.');

        return self::SUCCESS;
    }

    private function verifyPlatformUpstream(string $platform, string $vendorPath): int
    {
        $failed = false;

        foreach (PatchMap::forPlatform($platform) as $patch) {
            if (! $this->verifyUpstreamFile($vendorPath, $patch)) {
                $failed = true;
            }
        }

        if ($failed) {
            return self::FAILURE;
        }

        $this->info("[nativephp-patch] {$platform} upstream files verified successfully.");

        return self::SUCCESS;
    }

    /**
     * @param  array{target: string, upstream: string, upstream_hash: string, patched: string, patched_hash: string}  $patch
     */
    private function verifyUpstreamFile(string $vendorPath, array $patch): bool
    {
        $upstreamPath = $this->resolveVendorUpstreamPath($vendorPath, $patch['upstream']);

        if (! File::exists($upstreamPath)) {
            $this->warn("[nativephp-patch] Vendor file missing: {$upstreamPath}");

            return false;
        }

        if ($this->sha256($upstreamPath) !== $patch['upstream_hash']) {
            $this->warn("[nativephp-patch] Upstream hash mismatch for {$patch['upstream']}.");

            return false;
        }

        $this->line("[nativephp-patch] Verified: {$patch['upstream']}");

        return true;
    }

    private function resolveVendorPath(): string
    {
        $vendorPath = trim((string) $this->option('vendor-path'));

        if ($vendorPath === '') {
            $vendorPath = PatchMap::defaultVendorPath();
        }

        if (! str_starts_with($vendorPath, '/')) {
            $vendorPath = base_path($vendorPath);
        }

        return rtrim($vendorPath, '/');
    }

    private function resolveVendorUpstreamPath(string $vendorPath, string $upstream): string
    {
        $defaultVendor = PatchMap::defaultVendorPath();
        $relative = str_starts_with($upstream, $defaultVendor)
            ? ltrim(substr($upstream, strlen($defaultVendor)), '/')
            : ltrim($upstream, '/');

        return $vendorPath.'/'.$relative;
    }

    private function sha256(string $path): string
    {
        $hash = hash_file('sha256', $path);

        return $hash === false ? '' : $hash;
    }
}
