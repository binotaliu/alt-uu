<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

it('replaces ios and android native shell files when upstream hashes match', function (string $platform, array $fixtures): void {
    withNativeShellFixture($platform, $fixtures, function (string $buildPath, array $fixtures) use ($platform): void {
        $exitCode = Artisan::call('nativephp:nativephp-patch:apply', [
            '--platform' => $platform,
            '--build-path' => $buildPath,
        ]);

        expect($exitCode)->toBe(0);

        foreach ($fixtures as $target => $paths) {
            $patchedTemplatePath = base_path($paths['patched']);
            $targetPath = $buildPath.'/'.$target;

            expect(hash_file('sha256', $targetPath))->toBe(hash_file('sha256', $patchedTemplatePath));
        }
    });
})->with([
    'ios' => [
        'ios',
        [
            'NativePHP/ContentView.swift' => [
                'upstream' => 'vendor/nativephp/mobile/resources/xcode/NativePHP/ContentView.swift',
                'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/ContentView.swift',
            ],
            'NativePHP/NativeUI/NativeUIState.swift' => [
                'upstream' => 'vendor/nativephp/mobile/resources/xcode/NativePHP/NativeUI/NativeUIState.swift',
                'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/NativeUI/NativeUIState.swift',
            ],
            'NativePHP/PHPSchemeHandler.swift' => [
                'upstream' => 'vendor/nativephp/mobile/resources/xcode/NativePHP/PHPSchemeHandler.swift',
                'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/PHPSchemeHandler.swift',
            ],
            'NativePHP/AppUpdateManager.swift' => [
                'upstream' => 'vendor/nativephp/mobile/resources/xcode/NativePHP/AppUpdateManager.swift',
                'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/AppUpdateManager.swift',
            ],
        ],
    ],
    'android' => [
        'android',
        [
            'app/src/main/AndroidManifest.xml' => [
                'upstream' => 'vendor/nativephp/mobile/resources/androidstudio/app/src/main/AndroidManifest.xml',
                'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/AndroidManifest.xml',
            ],
            'app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt' => [
                'upstream' => 'vendor/nativephp/mobile/resources/androidstudio/app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt',
                'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt',
            ],
            'app/src/main/java/com/nativephp/mobile/ui/NativeUIModels.kt' => [
                'upstream' => 'vendor/nativephp/mobile/resources/androidstudio/app/src/main/java/com/nativephp/mobile/ui/NativeUIModels.kt',
                'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/java/com/nativephp/mobile/ui/NativeUIModels.kt',
            ],
            'app/src/main/java/com/nativephp/mobile/ui/NativeUIState.kt' => [
                'upstream' => 'vendor/nativephp/mobile/resources/androidstudio/app/src/main/java/com/nativephp/mobile/ui/NativeUIState.kt',
                'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/java/com/nativephp/mobile/ui/NativeUIState.kt',
            ],
            'app/src/main/java/com/nativephp/mobile/network/PHPWebViewClient.kt' => [
                'upstream' => 'vendor/nativephp/mobile/resources/androidstudio/app/src/main/java/com/nativephp/mobile/network/PHPWebViewClient.kt',
                'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/java/com/nativephp/mobile/network/PHPWebViewClient.kt',
            ],
        ],
    ],
]);

it('verifies ios vendor nativephp upstream files when hashes match', function (): void {
    $fixtures = [
        'resources/xcode/NativePHP/ContentView.swift' => [
            'upstream' => 'vendor/nativephp/mobile/resources/xcode/NativePHP/ContentView.swift',
            'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/ContentView.swift',
        ],
        'resources/xcode/NativePHP/NativeUI/NativeUIState.swift' => [
            'upstream' => 'vendor/nativephp/mobile/resources/xcode/NativePHP/NativeUI/NativeUIState.swift',
            'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/NativeUI/NativeUIState.swift',
        ],
        'resources/xcode/NativePHP/PHPSchemeHandler.swift' => [
            'upstream' => 'vendor/nativephp/mobile/resources/xcode/NativePHP/PHPSchemeHandler.swift',
            'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/PHPSchemeHandler.swift',
        ],
        'resources/xcode/NativePHP/AppUpdateManager.swift' => [
            'upstream' => 'vendor/nativephp/mobile/resources/xcode/NativePHP/AppUpdateManager.swift',
            'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/AppUpdateManager.swift',
        ],
    ];

    withNativeShellFixture('ios', $fixtures, function (string $vendorPath): void {
        $exitCode = Artisan::call('nativephp:nativephp-patch:verify', [
            '--platform' => 'ios',
            '--vendor-path' => $vendorPath,
        ]);

        expect($exitCode)->toBe(0);
        expect(Artisan::output())->toContain('[nativephp-patch] Verified: vendor/nativephp/mobile/resources/xcode/NativePHP/ContentView.swift');
    });
});

it('verifies android vendor nativephp upstream files when hashes match', function (): void {
    $fixtures = [
        'resources/androidstudio/app/src/main/AndroidManifest.xml' => [
            'upstream' => 'vendor/nativephp/mobile/resources/androidstudio/app/src/main/AndroidManifest.xml',
            'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/AndroidManifest.xml',
        ],
        'resources/androidstudio/app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt' => [
            'upstream' => 'vendor/nativephp/mobile/resources/androidstudio/app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt',
            'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt',
        ],
        'resources/androidstudio/app/src/main/java/com/nativephp/mobile/ui/NativeUIModels.kt' => [
            'upstream' => 'vendor/nativephp/mobile/resources/androidstudio/app/src/main/java/com/nativephp/mobile/ui/NativeUIModels.kt',
            'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/java/com/nativephp/mobile/ui/NativeUIModels.kt',
        ],
        'resources/androidstudio/app/src/main/java/com/nativephp/mobile/ui/NativeUIState.kt' => [
            'upstream' => 'vendor/nativephp/mobile/resources/androidstudio/app/src/main/java/com/nativephp/mobile/ui/NativeUIState.kt',
            'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/java/com/nativephp/mobile/ui/NativeUIState.kt',
        ],
        'resources/androidstudio/app/src/main/java/com/nativephp/mobile/network/PHPWebViewClient.kt' => [
            'upstream' => 'vendor/nativephp/mobile/resources/androidstudio/app/src/main/java/com/nativephp/mobile/network/PHPWebViewClient.kt',
            'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/java/com/nativephp/mobile/network/PHPWebViewClient.kt',
        ],
    ];

    withNativeShellFixture('android', $fixtures, function (string $vendorPath): void {
        $exitCode = Artisan::call('nativephp:nativephp-patch:verify', [
            '--platform' => 'android',
            '--vendor-path' => $vendorPath,
        ]);

        expect($exitCode)->toBe(0);
        expect(Artisan::output())
            ->toContain('[nativephp-patch] Verified: vendor/nativephp/mobile/resources/androidstudio/app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt')
            ->toContain('[nativephp-patch] Verified: vendor/nativephp/mobile/resources/androidstudio/app/src/main/java/com/nativephp/mobile/network/PHPWebViewClient.kt');
    });
});

it('generates diff files adjacent to patched nativephp templates', function (): void {
    $fixtures = [
        'resources/xcode/NativePHP/ContentView.swift' => [
            'upstream' => 'vendor/nativephp/mobile/resources/xcode/NativePHP/ContentView.swift',
            'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/ContentView.swift',
        ],
        'resources/xcode/NativePHP/NativeUI/NativeUIState.swift' => [
            'upstream' => 'vendor/nativephp/mobile/resources/xcode/NativePHP/NativeUI/NativeUIState.swift',
            'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/NativeUI/NativeUIState.swift',
        ],
        'resources/xcode/NativePHP/PHPSchemeHandler.swift' => [
            'upstream' => 'vendor/nativephp/mobile/resources/xcode/NativePHP/PHPSchemeHandler.swift',
            'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/PHPSchemeHandler.swift',
        ],
        'resources/xcode/NativePHP/AppUpdateManager.swift' => [
            'upstream' => 'vendor/nativephp/mobile/resources/xcode/NativePHP/AppUpdateManager.swift',
            'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/AppUpdateManager.swift',
        ],
    ];

    withNativeShellFixture('ios', $fixtures, function (string $vendorPath) use ($fixtures): void {
        $diffPath = base_path($fixtures['resources/xcode/NativePHP/ContentView.swift']['patched']).'.diff';

        try {
            if (File::exists($diffPath)) {
                File::delete($diffPath);
            }

            $exitCode = Artisan::call('nativephp:nativephp-patch:diff', [
                '--platform' => 'ios',
                '--vendor-path' => $vendorPath,
            ]);

            expect($exitCode)->toBe(0);
            expect(File::exists($diffPath))->toBeTrue();
            expect(File::get($diffPath))->toContain('---');
            expect(File::get($diffPath))->toContain('+++');
        } finally {
            if (File::exists($diffPath)) {
                File::delete($diffPath);
            }
        }
    });
});

it('fails when vendor nativephp upstream file hash mismatches', function (): void {
    $fixtures = [
        'resources/xcode/NativePHP/ContentView.swift' => [
            'upstream' => 'vendor/nativephp/mobile/resources/xcode/NativePHP/ContentView.swift',
            'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/ContentView.swift',
        ],
    ];

    withNativeShellFixture('ios', $fixtures, function (string $vendorPath): void {
        $targetFile = $vendorPath.'/resources/xcode/NativePHP/ContentView.swift';
        File::put($targetFile, File::get($targetFile)."\n// drift");

        $exitCode = Artisan::call('nativephp:nativephp-patch:verify', [
            '--platform' => 'ios',
            '--vendor-path' => $vendorPath,
        ]);

        expect($exitCode)->toBe(1);
        expect(Artisan::output())->toContain('[nativephp-patch] Upstream hash mismatch for vendor/nativephp/mobile/resources/xcode/NativePHP/ContentView.swift.');
    });
});

it('fails when target file does not match expected upstream hash', function (): void {
    $fixtures = [
        'NativePHP/ContentView.swift' => [
            'upstream' => 'vendor/nativephp/mobile/resources/xcode/NativePHP/ContentView.swift',
            'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/ContentView.swift',
        ],
    ];

    withNativeShellFixture('ios', $fixtures, function (string $buildPath): void {
        $targetFile = $buildPath.'/NativePHP/ContentView.swift';
        File::put($targetFile, File::get($targetFile)."\n// drift");

        $exitCode = Artisan::call('nativephp:nativephp-patch:apply', [
            '--platform' => 'ios',
            '--build-path' => $buildPath,
        ]);

        expect($exitCode)->toBe(1);
        expect(Artisan::output())->toContain('[nativephp-patch] Upstream hash mismatch for NativePHP/ContentView.swift.');
        expect(hash_file('sha256', $targetFile))->not->toBe(hash_file('sha256', base_path('packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/ContentView.swift')));
    });
});

/**
 * @param  array<string, array{upstream: string, patched: string}>  $fixtures
 */
function withNativeShellFixture(string $platform, array $fixtures, Closure $callback): void
{
    $buildPath = storage_path('framework/testing/nativephp-patch-'.$platform.'-'.Str::uuid());

    File::deleteDirectory($buildPath);

    foreach ($fixtures as $target => $paths) {
        $targetPath = $buildPath.'/'.$target;
        File::ensureDirectoryExists(dirname($targetPath));
        File::copy(base_path($paths['upstream']), $targetPath);
    }

    try {
        $callback($buildPath, $fixtures);
    } finally {
        File::deleteDirectory($buildPath);
    }
}
