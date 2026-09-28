<?php

declare(strict_types=1);

namespace AltUU\NativePHPPatch;

final class PatchMap
{
    private const VENDOR_PATH = 'vendor/nativephp/mobile';

    /**
     * @return array<string, list<array{target: string, upstream: string, upstream_hash: string, patched: string, patched_hash: string}>>
     */
    public static function all(): array
    {
        return [
            'ios' => [
                [
                    'target' => 'NativePHP/ContentView.swift',
                    'upstream' => self::VENDOR_PATH.'/resources/xcode/NativePHP/ContentView.swift',
                    'upstream_hash' => '4c325e9aeed290fbb080bb9ebc8f607d66b6a41ec48f959e38c384a8f6a33643',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/ContentView.swift',
                    'patched_hash' => 'd9df51de9d177928b576dff6816f68cc6808a87e6918de3bd04ed529ff5cbd24',
                ],
                [
                    'target' => 'NativePHP/NativeUI/NativeUIState.swift',
                    'upstream' => self::VENDOR_PATH.'/resources/xcode/NativePHP/NativeUI/NativeUIState.swift',
                    'upstream_hash' => '2eca86aed9555262b6fd220c26ca55b4ec46b6c5971bbc2dba0dc710ef3a167a',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/NativeUI/NativeUIState.swift',
                    'patched_hash' => '5ace535bd53ac3982a40dce447009ce51b8263a6f0d0dd7fdf3c3a1cb9f44dbc',
                ],
                [
                    'target' => 'NativePHP/PHPSchemeHandler.swift',
                    'upstream' => self::VENDOR_PATH.'/resources/xcode/NativePHP/PHPSchemeHandler.swift',
                    'upstream_hash' => '89d4587949a5ca9b6eab122fad661b3b48c9b7b45889dd58040873fb3d2004d2',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/PHPSchemeHandler.swift',
                    'patched_hash' => 'dc4150de4ea5e015253ec92f430dc1d447ff258a79dc77d81efdaf67fca5b62e',
                ],
            ],
            'android' => [
                [
                    'target' => 'app/src/main/AndroidManifest.xml',
                    'upstream' => self::VENDOR_PATH.'/resources/androidstudio/app/src/main/AndroidManifest.xml',
                    // AndroidManifest.xml 會先被修改過，所以這裡的 upstream_hash 會跟 vendor 裡的檔案不一樣，這裡的 upstream_hash 是修改過後的版本的 hash
                    'upstream_hash' => '*',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/AndroidManifest.xml',
                    'patched_hash' => '4acda9ac8881b49bb5f4f8eea970840694d5ecdc4612e111444f92ab574cdfe9',
                ],
                [
                    'target' => 'app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt',
                    'upstream' => self::VENDOR_PATH.'/resources/androidstudio/app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt',
                    // 這裡的也是被修改 (REPLACE_STATUS_BAR_STYLE)
                    'upstream_hash' => '*',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt',
                    'patched_hash' => '859a2b44deb625c6a4a7042f4fb467ca286e1d90ffc166b176b1d08df03e4a5d',
                ],
                [
                    'target' => 'app/src/main/java/com/nativephp/mobile/ui/NativeUIModels.kt',
                    'upstream' => self::VENDOR_PATH.'/resources/androidstudio/app/src/main/java/com/nativephp/mobile/ui/NativeUIModels.kt',
                    'upstream_hash' => '9dee0bb67eb0fa9b3fe926dd024813e6950208aa5155b5e22f84668cc73c9107',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/java/com/nativephp/mobile/ui/NativeUIModels.kt',
                    'patched_hash' => '4f6af3023fa2ecad563b66246c5897c5d8a7f28b5f300973a2efafa0d912a6fb',
                ],
                [
                    'target' => 'app/src/main/java/com/nativephp/mobile/ui/NativeUIState.kt',
                    'upstream' => self::VENDOR_PATH.'/resources/androidstudio/app/src/main/java/com/nativephp/mobile/ui/NativeUIState.kt',
                    'upstream_hash' => '261050d3ae71b44f3588d970c1068b68ace435b7886afc756b7deb0980da4c14',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/java/com/nativephp/mobile/ui/NativeUIState.kt',
                    'patched_hash' => '0aadbf31176bb67fd24cf2ac9210dd2e58ff136d9e83c1e7894619dab1447f2c',
                ],
                [
                    'target' => 'app/src/main/java/com/nativephp/mobile/network/PHPWebViewClient.kt',
                    'upstream' => self::VENDOR_PATH.'/resources/androidstudio/app/src/main/java/com/nativephp/mobile/network/PHPWebViewClient.kt',
                    'upstream_hash' => '86810698435695dc0be8e9b635c7b4dc64115541125afe1b011f2594455c51ae',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/java/com/nativephp/mobile/network/PHPWebViewClient.kt',
                    'patched_hash' => '57e84a55b7cb397eeb599415cb29ce9cbb9d341c9607ad4d089622b684d57470',
                ],
                [
                    // Fixes a production SIGSEGV inside ts_resource_ex (Play Console:
                    // ~14 crashes / 12 users / 28 days). php_initialized and TSRM's
                    // process-wide resource table are mutated by four independent code
                    // paths (classic/persistent under g_php_request_mutex, ephemeral +
                    // artisan-command under g_ephemeral_mutex, queue worker under
                    // g_worker_mutex) that don't synchronize with each other. When a
                    // WebView request falls back to classic mode (persistent boot not
                    // yet settled, or failed) at the same moment a background
                    // WorkManager job or the queue worker calls ts_resource(0)/
                    // php_embed_init(), both threads race on the shared TSRM table.
                    // Patch nests g_php_request_mutex inside each context's own mutex
                    // around every ts_resource/php_embed_init/php_embed_shutdown/
                    // ts_free_thread call, closing the boot/shutdown race. See the
                    // "altuu patch" comments in the patched file for the full writeup.
                    'target' => 'app/src/main/cpp/php_bridge.c',
                    'upstream' => self::VENDOR_PATH.'/resources/androidstudio/app/src/main/cpp/php_bridge.c',
                    'upstream_hash' => '812c19a1e61a8160d62f5acf5d078b8447a63ae7022feec31327b6e41424cc0d',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/cpp/php_bridge.c',
                    'patched_hash' => 'ba7ee02e745fbefb151054ad368731b698b95a4f0c5327b345d4f3c15503cf3e',
                ],
                [
                    // Upstream pins kotlin=2.0.0 in this catalog but hardcodes
                    // androidx.compose:compose-bom:2025.12.00 directly in app/build.gradle.kts,
                    // which requires Kotlin 2.2+ stdlib metadata. Gradle's conflict resolution
                    // bumps kotlin-stdlib transitively to 2.2.10 while the 2.0.0 compiler can't
                    // read it, causing "Unresolved reference" build failures. Bump kotlin to match.
                    'target' => 'gradle/libs.versions.toml',
                    'upstream' => self::VENDOR_PATH.'/resources/androidstudio/gradle/libs.versions.toml',
                    'upstream_hash' => '856eb966c6b265506068998fbcc3958f9b33f1ec8002f50e9ec786f5f4dd068f',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/gradle/libs.versions.toml',
                    'patched_hash' => '09a03ca7795bbe86e07f7a6415fa45ad9e201b5f4d453ac5897e5492129d4f0e',
                ],
            ],
        ];
    }

    /**
     * @return list<array{target: string, upstream: string, upstream_hash: string, patched: string, patched_hash: string}>
     */
    public static function forPlatform(string $platform): array
    {
        return self::all()[$platform] ?? [];
    }

    public static function defaultVendorPath(): string
    {
        return self::VENDOR_PATH;
    }
}
