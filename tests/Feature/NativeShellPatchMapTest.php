<?php

use AltUU\NativePHPPatch\PatchMap;

it('keeps every patched_hash in sync with its committed patch template', function () {
    $stale = [];

    foreach (['ios', 'android'] as $platform) {
        foreach (PatchMap::forPlatform($platform) as $patch) {
            $path = base_path($patch['patched']);

            if (! file_exists($path)) {
                $stale[] = "{$platform}: {$patch['target']} - patched template missing at {$path}";

                continue;
            }

            if (hash_file('sha256', $path) !== $patch['patched_hash']) {
                $stale[] = "{$platform}: {$patch['target']} - patched_hash in PatchMap does not match {$patch['patched']}";
            }
        }
    }

    expect($stale)->toBe([]);
});

it('only patches the shell files a fully native app still needs', function () {
    expect(PatchMap::forPlatform('ios'))->toBe([])
        ->and(array_column(PatchMap::forPlatform('android'), 'target'))->toBe([
            'app/src/main/AndroidManifest.xml',
            'app/src/main/cpp/php_bridge.c',
            'gradle/libs.versions.toml',
        ]);
});

it('ships no template or diff for removed webview shell patches', function () {
    $root = base_path('packages/altuu/plugin-nativephp-patch/resources/patches');

    foreach ([
        'ios/NativePHP/ContentView.swift',
        'ios/NativePHP/PHPSchemeHandler.swift',
        'android/app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt',
        'android/app/src/main/java/com/nativephp/mobile/network/PHPWebViewClient.kt',
    ] as $removed) {
        expect(file_exists("{$root}/{$removed}"))->toBeFalse()
            ->and(file_exists("{$root}/{$removed}.diff"))->toBeFalse();
    }
});

it('keeps the zh-Hant-TW localization keys in the patch plugin manifest', function () {
    $manifest = json_decode(file_get_contents(base_path('packages/altuu/plugin-nativephp-patch/nativephp.json')), true);

    expect($manifest['ios']['info_plist']['CFBundleDevelopmentRegion'])->toBe('zh-Hant-TW')
        ->and($manifest['ios']['info_plist']['CFBundleLocalizations'])->toBe(['zh-Hant-TW']);
});
