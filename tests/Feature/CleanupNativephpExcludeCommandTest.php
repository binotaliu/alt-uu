<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;

it('skips cleanup when not under nativephp/ios/laravel', function () {
    $exitCode = Artisan::call('nativephp:cleanup-excluded-files', [
        '--path' => base_path(),
    ]);

    expect($exitCode)->toBe(0);
    expect(Artisan::output())->toContain('Skipping cleanup: path is not under nativephp/ios/laravel');
});

it('removes configured excluded resources under nativephp/ios/laravel', function () {
    $target = storage_path('framework/testing/nativephp/ios/laravel');

    File::ensureDirectoryExists($target);

    // Create fixture entries matching cleanup_exclude_files defaults
    File::ensureDirectoryExists($target.'/.github');
    File::put($target.'/.github/README.md', 'dummy');
    File::ensureDirectoryExists($target.'/database');
    File::put($target.'/database/database.sqlite', 'dummy');

    $exitCode = Artisan::call('nativephp:cleanup-excluded-files', [
        '--path' => $target,
    ]);

    expect($exitCode)->toBe(0);
    expect(Artisan::output())->toContain('Cleanup complete.');
    expect(File::exists($target.'/.github'))->toBeFalse();
    expect(File::exists($target.'/database/database.sqlite'))->toBeFalse();

    File::deleteDirectory($target);
});
