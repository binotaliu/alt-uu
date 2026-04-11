<?php

declare(strict_types=1);

namespace AltUU\NativePHPPatch\Commands;

use AltUU\NativePHPPatch\PatchMap;
use Illuminate\Support\Facades\File;
use Native\Mobile\Plugins\Commands\NativePluginHookCommand;
use Symfony\Component\Process\Process;

final class GenerateNativeShellPatchDiffCommand extends NativePluginHookCommand
{
    protected $signature = 'nativephp:nativephp-patch:diff {--vendor-path= : Base vendor/nativephp/mobile path to compare} {--patch-root= : Optional base path for patch template files}';

    protected $description = 'Generate unified diffs for nativephp patch templates against expected vendor upstream files.';

    public function handle(): int
    {
        if ($this->isIos()) {
            return $this->generatePlatformDiffs('ios', $this->resolveVendorPath(), $this->resolvePatchRoot());
        }

        if ($this->isAndroid()) {
            return $this->generatePlatformDiffs('android', $this->resolveVendorPath(), $this->resolvePatchRoot());
        }

        $this->line('[nativephp-patch] Skipping unsupported platform.');

        return self::SUCCESS;
    }

    private function generatePlatformDiffs(string $platform, string $vendorPath, string $patchRoot): int
    {
        $failed = false;

        foreach (PatchMap::forPlatform($platform) as $patch) {
            if (! $this->generateSingleDiff($vendorPath, $patch, $patchRoot)) {
                $failed = true;
            }
        }

        if ($failed) {
            return self::FAILURE;
        }

        $this->info("[nativephp-patch] {$platform} diff files generated successfully.");

        return self::SUCCESS;
    }

    /**
     * @param  array{target: string, upstream: string, upstream_hash: string, patched: string, patched_hash: string}  $patch
     */
    private function generateSingleDiff(string $vendorPath, array $patch, string $patchRoot): bool
    {
        $upstreamPath = $this->resolveVendorUpstreamPath($vendorPath, $patch['upstream']);
        $patchedTemplatePath = $this->resolvePatchedTemplatePath($patchRoot, $patch['patched']);
        $diffPath = $patchedTemplatePath.'.diff';

        if (! File::exists($upstreamPath)) {
            $this->warn("[nativephp-patch] Vendor upstream file missing: {$upstreamPath}");

            return false;
        }

        if (! File::exists($patchedTemplatePath)) {
            $this->warn("[nativephp-patch] Patched template missing: {$patchedTemplatePath}");

            return false;
        }

        $diff = $this->computeUnifiedDiff($upstreamPath, $patchedTemplatePath);

        if ($diff === null) {
            $this->warn("[nativephp-patch] Unable to generate diff for {$patch['patched']}. Please ensure `diff` or the xdiff extension is available.");

            return false;
        }

        File::put($diffPath, $diff);
        $this->info("[nativephp-patch] Generated diff: {$diffPath}");

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

    private function resolvePatchRoot(): string
    {
        $patchRoot = trim((string) $this->option('patch-root'));

        if ($patchRoot === '') {
            return base_path('');
        }

        return str_starts_with($patchRoot, '/') ? rtrim($patchRoot, '/') : rtrim(base_path($patchRoot), '/');
    }

    private function resolveVendorUpstreamPath(string $vendorPath, string $upstream): string
    {
        $defaultVendor = PatchMap::defaultVendorPath();
        $relative = str_starts_with($upstream, $defaultVendor)
            ? ltrim(substr($upstream, strlen($defaultVendor)), '/')
            : ltrim($upstream, '/');

        return $vendorPath.'/'.$relative;
    }

    private function resolvePatchedTemplatePath(string $patchRoot, string $patched): string
    {
        if (str_starts_with($patched, '/')) {
            return $patched;
        }

        return $patchRoot.'/'.$patched;
    }

    private function computeUnifiedDiff(string $fromPath, string $toPath): ?string
    {
        if (function_exists('xdiff_string_diff')) {
            $diff = xdiff_string_diff(File::get($fromPath), File::get($toPath), 1);

            return $diff === false ? '' : $diff;
        }

        if (! class_exists(Process::class)) {
            return null;
        }

        $process = new Process([
            'diff',
            '-u',
            '--label', $fromPath,
            '--label', $toPath,
            $fromPath,
            $toPath,
        ]);
        $process->run();

        if ($process->getExitCode() === 0) {
            return '';
        }

        if ($process->getExitCode() === 1) {
            return $process->getOutput();
        }

        return null;
    }
}
