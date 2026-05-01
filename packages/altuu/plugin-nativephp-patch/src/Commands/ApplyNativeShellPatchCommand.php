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

        if ($platform === 'ios' && ! $this->enforceSingleWindowBuildSetting($buildPath)) {
            return self::FAILURE;
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

        if (
            $patch['upstream_hash'] !== '*'
            && $currentHash !== $patch['upstream_hash']
        ) {
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

    private function enforceSingleWindowBuildSetting(string $buildPath): bool
    {
        $projectPath = $buildPath.'/NativePHP.xcodeproj/project.pbxproj';

        if (! File::exists($projectPath)) {
            $this->warn("[nativephp-patch] Xcode project file not found: {$projectPath}");

            return false;
        }

        $content = File::get($projectPath);

        // Step 1: Disable auto-generation of UIApplicationSceneManifest.
        // When Generation=YES, Xcode detects SwiftUI WindowGroup and rewrites
        // UIApplicationSupportsMultipleScenes=true, overriding everything else.
        $updatedContent = preg_replace(
            '/INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;/',
            'INFOPLIST_KEY_UIApplicationSceneManifest_Generation = NO;',
            $content
        );

        if ($updatedContent === null) {
            $this->warn('[nativephp-patch] Failed to update scene manifest generation setting.');

            return false;
        }

        // Step 2: Force UIApplicationSupportsMultipleScenes=NO wherever the key exists.
        $updatedContent = preg_replace(
            '/INFOPLIST_KEY_UIApplicationSceneManifest_UIApplicationSupportsMultipleScenes = (YES|NO);/',
            'INFOPLIST_KEY_UIApplicationSceneManifest_UIApplicationSupportsMultipleScenes = NO;',
            $updatedContent,
            -1,
            $replacementCount
        );

        if ($updatedContent === null) {
            $this->warn('[nativephp-patch] Failed to update scene manifest build setting.');

            return false;
        }

        // Step 3: If the key was absent, inject it after GENERATE_INFOPLIST_FILE = YES.
        if ($replacementCount === 0) {
            $updatedContent = preg_replace(
                '/(GENERATE_INFOPLIST_FILE = YES;)/',
                "$1\n\t\t\t\tINFOPLIST_KEY_UIApplicationSceneManifest_UIApplicationSupportsMultipleScenes = NO;",
                $updatedContent,
                -1,
                $insertedCount
            );

            if ($updatedContent === null || ($insertedCount ?? 0) === 0) {
                $this->warn('[nativephp-patch] Could not inject scene manifest build setting in project.pbxproj.');

                return false;
            }
        }

        if ($updatedContent !== $content) {
            File::put($projectPath, $updatedContent);
            $this->info('[nativephp-patch] Updated project.pbxproj (search/replace) to disable multiple scenes.');
        } else {
            $this->line('[nativephp-patch] project.pbxproj already enforces single-window mode.');
        }

        return true;
    }
}
