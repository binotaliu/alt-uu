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
                    'upstream_hash' => '68742370d4321b085c457ab908dff17d22100f0004482443c1d976c224dad240',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/ContentView.swift',
                    'patched_hash' => '55012cffc5189471baacaa3644152b4503d4e6bc8f3f5744446a6a8235eb663d',
                ],
                [
                    'target' => 'NativePHP/PHPSchemeHandler.swift',
                    'upstream' => self::VENDOR_PATH.'/resources/xcode/NativePHP/PHPSchemeHandler.swift',
                    'upstream_hash' => '739c25032ac2ac1eba1609fd9a0138d96968dfa178e28edb9494804908c03060',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/PHPSchemeHandler.swift',
                    'patched_hash' => 'fc176faad38e4222254565e46b2d1c2612c9b7f543bae232ce852717de25c431',
                ],
            ],
            'android' => [
                [
                    'target' => 'app/src/main/AndroidManifest.xml',
                    'upstream' => self::VENDOR_PATH.'/resources/androidstudio/app/src/main/AndroidManifest.xml',
                    // AndroidManifest.xml 會先被修改過，所以這裡的 upstream_hash 會跟 vendor 裡的檔案不一樣，這裡的 upstream_hash 是修改過後的版本的 hash
                    'upstream_hash' => '*',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/AndroidManifest.xml',
                    'patched_hash' => '145af1ea7886faef37062ee9e326483a8f54632432e1943ea6d6da670ac4cc8a',
                ],
                [
                    'target' => 'app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt',
                    'upstream' => self::VENDOR_PATH.'/resources/androidstudio/app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt',
                    // 這裡的也是被修改 (REPLACE_STATUS_BAR_STYLE)
                    'upstream_hash' => '*',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt',
                    'patched_hash' => '23416429be3764e344b1d6d1f3b3d1c0c1d1115dbeb5fc3a8e609bf39b835c21',
                ],
                [
                    'target' => 'app/src/main/java/com/nativephp/mobile/network/PHPWebViewClient.kt',
                    'upstream' => self::VENDOR_PATH.'/resources/androidstudio/app/src/main/java/com/nativephp/mobile/network/PHPWebViewClient.kt',
                    'upstream_hash' => 'ccb315865cbc9606a7d6f514f44f62f1f606362eb0532bbf5da8d48df0d6a23c',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/java/com/nativephp/mobile/network/PHPWebViewClient.kt',
                    'patched_hash' => 'c6812e362e132d6934f010b1743718b657ee25a24679d28f5b412c4ddb119316',
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
                    'upstream_hash' => 'a763c486ae55a2d780f0d0c98e6f21a717656d211a98914023e094f05faa26d3',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/cpp/php_bridge.c',
                    'patched_hash' => '549e7ec6d24feba8e68d7d21d8668f82c8fb1cec49cb4ff1ff95d096a1dae6c5',
                ],
                [
                    // Upstream pins kotlin=2.0.0 in this catalog but hardcodes
                    // androidx.compose:compose-bom:2025.12.00 directly in app/build.gradle.kts,
                    // which requires Kotlin 2.2+ stdlib metadata. Gradle's conflict resolution
                    // bumps kotlin-stdlib transitively to 2.2.10 while the 2.0.0 compiler can't
                    // read it, causing "Unresolved reference" build failures. Bump kotlin to match.
                    'target' => 'gradle/libs.versions.toml',
                    'upstream' => self::VENDOR_PATH.'/resources/androidstudio/gradle/libs.versions.toml',
                    'upstream_hash' => '421ece4fdc93e3b1d5e4641d2d80117fa9bdf8972a155e9032aaafbb8b1edc80',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/gradle/libs.versions.toml',
                    'patched_hash' => 'da05dcfbe4bbdcad25d846a99a323827d3a0ea8a16bbfd5f21576222b23dc1ff',
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
