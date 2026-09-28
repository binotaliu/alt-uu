<?php

declare(strict_types=1);

namespace AltUU\AltUUPlus\Commands;

use Illuminate\Support\Facades\File;
use Native\Mobile\Plugins\Commands\NativePluginHookCommand;

final class PreCompileCommand extends NativePluginHookCommand
{
    protected $signature = 'nativephp:alt-uu-plus:pre-compile';

    protected $description = 'Attach the local StoreKit configuration to the generated Xcode project/scheme';

    private const STOREKIT_SOURCE = __DIR__.'/../../resources/AltUUPlus.storekit';

    private const STOREKIT_TARGET_NAME = 'AltUUPlus.storekit';

    private const SCHEME_RELATIVE_PATH = 'NativePHP.xcodeproj/xcshareddata/xcschemes/NativePHP-simulator.xcscheme';

    private const PROJECT_RELATIVE_PATH = 'NativePHP.xcodeproj/project.pbxproj';

    /**
     * Native targets that need the .storekit file bundled so it resolves in
     * both the "Run on simulator" and "Run on device" schemes. Deliberately
     * excludes NativePHPTests/NativePHPUITests, matching what Xcode itself
     * registered when the file was added to the project by hand.
     */
    private const APP_TARGET_NAMES = ['NativePHP-simulator', 'NativePHP'];

    public function handle(): int
    {
        if (! $this->isIos()) {
            return self::SUCCESS;
        }

        $buildPath = $this->buildPath();

        if (! $this->copyStoreKitConfiguration($buildPath)) {
            return self::FAILURE;
        }

        if (! $this->attachToScheme($buildPath)) {
            return self::FAILURE;
        }

        if (! $this->registerInXcodeProject($buildPath)) {
            return self::FAILURE;
        }

        $this->info('[alt-uu-plus] StoreKit configuration attached to simulator scheme.');

        return self::SUCCESS;
    }

    private function copyStoreKitConfiguration(string $buildPath): bool
    {
        $source = self::STOREKIT_SOURCE;

        if (! File::exists($source)) {
            $this->warn("[alt-uu-plus] StoreKit configuration not found: {$source}");

            return false;
        }

        File::copy($source, $buildPath.'/'.self::STOREKIT_TARGET_NAME);

        return true;
    }

    private function attachToScheme(string $buildPath): bool
    {
        $schemePath = $buildPath.'/'.self::SCHEME_RELATIVE_PATH;

        if (! File::exists($schemePath)) {
            $this->warn("[alt-uu-plus] Xcode scheme not found: {$schemePath}");

            return false;
        }

        $content = File::get($schemePath);

        if (str_contains($content, '<StoreKitConfigurationFileReference')) {
            $this->line('[alt-uu-plus] Scheme already references StoreKit configuration.');

            return true;
        }

        // Empirically confirmed against a real Xcode build: Xcode does not
        // resolve this identifier as a naive filesystem-relative path from
        // the .xcscheme file - it cross-references it against the project's
        // registered file members (see registerInXcodeProject() below),
        // which is also why "file not found" persisted until the .storekit
        // file was a project member. "../" is what Xcode itself writes
        // once that membership exists; don't "correct" it via path math.
        $reference = "<StoreKitConfigurationFileReference\n"
            .'         identifier = "../'.self::STOREKIT_TARGET_NAME."\">\n"
            ."      </StoreKitConfigurationFileReference>\n      ";

        $updated = preg_replace(
            '/(<LaunchAction\b[^>]*>\s*)/',
            '$1'.$reference,
            $content,
            1,
            $count
        );

        if ($updated === null || $count === 0) {
            $this->warn('[alt-uu-plus] Could not locate <LaunchAction> in scheme file.');

            return false;
        }

        File::put($schemePath, $updated);

        return true;
    }

    /**
     * Xcode's StoreKit Configuration picker refuses to resolve a scheme's
     * <StoreKitConfigurationFileReference> unless the file is also a member
     * of the project (a PBXFileReference bundled into the running targets'
     * Resources phase) - a relative path on disk alone isn't enough. This
     * replicates, as project.pbxproj edits, exactly what Xcode itself writes
     * when the file is added via "Add Files to project" in the GUI.
     */
    private function registerInXcodeProject(string $buildPath): bool
    {
        $projectPath = $buildPath.'/'.self::PROJECT_RELATIVE_PATH;

        if (! File::exists($projectPath)) {
            $this->warn("[alt-uu-plus] Xcode project file not found: {$projectPath}");

            return false;
        }

        $content = File::get($projectPath);

        if (str_contains($content, 'path = '.self::STOREKIT_TARGET_NAME.';')) {
            $this->line('[alt-uu-plus] StoreKit configuration already a project member.');

            return true;
        }

        $fileRefId = $this->deterministicId('file-ref');

        $content = $this->insertAfterSectionStart(
            $content,
            'PBXFileReference',
            "\t\t{$fileRefId} /* ".self::STOREKIT_TARGET_NAME.' */ = {isa = PBXFileReference; lastKnownFileType = text; path = '.self::STOREKIT_TARGET_NAME.'; sourceTree = "<group>"; };'."\n"
        );

        $buildFileEntries = '';
        $buildFileIdsByTarget = [];

        foreach (self::APP_TARGET_NAMES as $targetName) {
            $buildFileId = $this->deterministicId('build-file-'.$targetName);
            $buildFileIdsByTarget[$targetName] = $buildFileId;
            $buildFileEntries .= "\t\t{$buildFileId} /* ".self::STOREKIT_TARGET_NAME.' in Resources */ = {isa = PBXBuildFile; fileRef = '.$fileRefId.' /* '.self::STOREKIT_TARGET_NAME." */; };\n";
        }

        $content = $this->insertAfterSectionStart($content, 'PBXBuildFile', $buildFileEntries);

        $mainGroupId = $this->mainGroupId($content);

        if ($mainGroupId === null) {
            $this->warn('[alt-uu-plus] Could not resolve the project\'s main group.');

            return false;
        }

        $content = $this->insertIntoGroupChildren($content, $mainGroupId, $fileRefId, self::STOREKIT_TARGET_NAME);

        foreach (self::APP_TARGET_NAMES as $targetName) {
            $phaseId = $this->resourcesBuildPhaseId($content, $targetName);

            if ($phaseId === null) {
                $this->warn("[alt-uu-plus] Could not resolve the Resources build phase for target: {$targetName}");

                return false;
            }

            $content = $this->insertIntoResourcesPhase(
                $content,
                $phaseId,
                $buildFileIdsByTarget[$targetName],
                self::STOREKIT_TARGET_NAME
            );
        }

        File::put($projectPath, $content);

        return true;
    }

    private function insertAfterSectionStart(string $content, string $section, string $entry): string
    {
        return preg_replace(
            '/(\/\* Begin '.preg_quote($section, '/').' section \*\/\n)/',
            '$1'.$entry,
            $content,
            1
        ) ?? $content;
    }

    private function mainGroupId(string $content): ?string
    {
        if (preg_match('/mainGroup = ([0-9A-Fa-f]{24});/', $content, $matches)) {
            return $matches[1];
        }

        return null;
    }

    private function insertIntoGroupChildren(string $content, string $groupId, string $childId, string $childComment): string
    {
        $pattern = '/('.preg_quote($groupId, '/').' = \{\s*isa = PBXGroup;\s*children = \(\n)/';

        return preg_replace(
            $pattern,
            '$1'."\t\t\t\t{$childId} /* {$childComment} */,\n",
            $content,
            1
        ) ?? $content;
    }

    /**
     * Locates the PBXNativeTarget block for a given target name and returns
     * the UUID of its Resources build phase. Resolved by name/structure
     * rather than hard-coded UUIDs so this survives nativephp/mobile
     * regenerating the Xcode project template with new identifiers.
     */
    private function resourcesBuildPhaseId(string $content, string $targetName): ?string
    {
        if (! preg_match_all('/\{\s*isa = PBXNativeTarget;.*?\n\s*\};/s', $content, $blocks)) {
            return null;
        }

        foreach ($blocks[0] as $block) {
            if (! preg_match('/name = "?'.preg_quote($targetName, '/').'"?;/', $block)) {
                continue;
            }

            if (preg_match('/([0-9A-Fa-f]{24}) \/\* Resources \*\//', $block, $phaseMatch)) {
                return $phaseMatch[1];
            }
        }

        return null;
    }

    private function insertIntoResourcesPhase(string $content, string $phaseId, string $buildFileId, string $fileComment): string
    {
        $pattern = '/('.preg_quote($phaseId, '/').' \/\* Resources \*\/ = \{\s*isa = PBXResourcesBuildPhase;\s*buildActionMask = \d+;\s*files = \(\n)/';

        return preg_replace(
            $pattern,
            '$1'."\t\t\t\t{$buildFileId} /* {$fileComment} in Resources */,\n",
            $content,
            1
        ) ?? $content;
    }

    private function deterministicId(string $seed): string
    {
        return strtoupper(substr(hash('sha256', 'altuu-alt-uu-plus:'.$seed), 0, 24));
    }
}
