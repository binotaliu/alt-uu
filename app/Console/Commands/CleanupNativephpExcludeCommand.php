<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Symfony\Component\Console\Attribute\AsCommand;

#[AsCommand(name: 'nativephp:cleanup-excluded-files')]
final class CleanupNativephpExcludeCommand extends Command
{
    protected $signature = 'nativephp:cleanup-excluded-files {--path=}';

    protected $description = 'Remove paths listed in nativephp.cleanup_exclude_files when running under nativephp/ios/laravel';

    public function handle(): int
    {
        $targetPath = $this->option('path')
            ? rtrim($this->option('path'), '/\\')
            : rtrim(base_path(), '/\\');

        if (! is_dir($targetPath)) {
            $this->info("Skipping cleanup: path does not exist: {$targetPath}");

            return self::SUCCESS;
        }

        $expectedSuffix = DIRECTORY_SEPARATOR.'nativephp'.DIRECTORY_SEPARATOR.'ios'.DIRECTORY_SEPARATOR.'laravel';

        if (! str_ends_with($targetPath, $expectedSuffix)) {
            $this->info("Skipping cleanup: path is not under nativephp/ios/laravel: {$targetPath}");

            return self::SUCCESS;
        }

        $patterns = config('nativephp.cleanup_exclude_files', []);

        if (empty($patterns)) {
            $this->info('No cleanup_exclude_files configured. Nothing to remove.');

            return self::SUCCESS;
        }

        $removed = 0;

        foreach ($patterns as $pattern) {
            $absolutePattern = $targetPath.DIRECTORY_SEPARATOR.$pattern;
            $matches = glob($absolutePattern, GLOB_BRACE | GLOB_NOSORT);

            if ($matches === false) {
                continue;
            }

            if (count($matches) === 0 && ! str_contains($pattern, '*')) {
                $matches = [$absolutePattern];
            }

            foreach ($matches as $item) {
                if (! file_exists($item)) {
                    continue;
                }

                if (is_dir($item)) {
                    File::deleteDirectory($item);
                    $this->line("Deleted directory: {$item}");
                    $removed++;

                    continue;
                }

                if (is_file($item)) {
                    unlink($item);
                    $this->line("Deleted file: {$item}");
                    $removed++;

                    continue;
                }
            }
        }

        $this->info("Cleanup complete. Removed {$removed} path(s) from {$targetPath}.");

        return self::SUCCESS;
    }
}
