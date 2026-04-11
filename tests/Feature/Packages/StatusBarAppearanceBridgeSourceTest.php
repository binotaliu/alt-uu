<?php

use Illuminate\Support\Facades\File;

it('allows android webview to update status bar style at runtime', function () {
    $source = File::get(base_path('packages/altuu/plugin-nativephp-patch/resources/patches/android/app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt'));

    expect($source)
        ->toContain('private var runtimeStatusBarStyle = statusBarStyle')
        ->toContain('private fun setStatusBarStyleFromWeb(rawStyle: String?)')
        ->toContain('fun setStatusBarStyle(style: String?)')
        ->toContain('setStatusBarStyleFromWeb(style)');
});

it('syncs settings appearance preference to android status bar style', function () {
    $source = File::get(base_path('resources/js/pages/Settings/Index.vue'));

    expect($source)
        ->toContain('function syncNativeStatusBarStyle(value:')
        ->toContain("const style = value === 'system' ? 'auto' : value;")
        ->toContain('syncNativeStatusBarStyle(appearance.value);')
        ->toContain('syncNativeStatusBarStyle(value);');
});
