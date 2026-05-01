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
                    'upstream_hash' => '41af75f5d272643936020fb6fea47cf20f19249176220d3e8ee0d1f916168249',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/ContentView.swift',
                    'patched_hash' => 'b615de1b10a639b0b3ff6afd8382a72cd52290809417491278064fa7dbcee31d',
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
                    'upstream_hash' => 'e6c684525cc083abc84c23e990ad57b6be4913e8bec12a2e925e7b255b567622',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/PHPSchemeHandler.swift',
                    'patched_hash' => '217e68f85d7ba742e565ac3f87ee7990442024a11301063e6edbfd5a59b04f3a',
                ],
                [
                    'target' => 'NativePHP/AppUpdateManager.swift',
                    'upstream' => self::VENDOR_PATH.'/resources/xcode/NativePHP/AppUpdateManager.swift',
                    'upstream_hash' => '46fac830ad4598e80e4e2dd1e27ed5c575cd0d4fb768b89b65c607a5f18b0beb',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/ios/NativePHP/AppUpdateManager.swift',
                    'patched_hash' => 'bb158aad4b5c43238d11f2b5d30f5bca130273dda1ddaafd58747f01b8f7c854',
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
                    'patched_hash' => 'cef3d899cacf5c4fd2018ee0c4134807289e08503acfe49fc09fbc502762b18e',
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
                    'upstream_hash' => '9cbf165967343af4d861f22591c2cffa358e2167a21f2ff19018c5dbe84bed44',
                    'patched' => 'packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/java/com/nativephp/mobile/network/PHPWebViewClient.kt',
                    'patched_hash' => '7d541de21cdbb29a6da2ea0fd4a418ff4421814773eb7253d32c2043d2bef147',
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
