<?php

use Illuminate\Support\Facades\File;

it('exposes screen reader enhanced support toggle in settings page', function () {
    $source = File::get(base_path('resources/js/pages/Settings/Index.vue'));

    expect($source)
        ->toContain('/api/preferences/screen-reader-enhanced-support')
        ->toContain('setScreenReaderEnhancedSupportEnabled')
        ->toContain('增強螢幕閱讀器支援');
});

it('passes web player preference to material viewer', function () {
    $materialSource = File::get(base_path('resources/js/pages/Courses/Material.vue'));
    $viewerSource = File::get(base_path('resources/js/components/MaterialViewer.vue'));

    expect($materialSource)
        ->toContain(':prefer-web-player="configStore.screenReaderEnhancedSupportEnabled"');

    expect($viewerSource)
        ->toContain('preferWebPlayer: boolean')
        ->toContain('() => props.preferWebPlayer')
        ->toContain('isNativeMediaBridgeAvailable() && !props.preferWebPlayer');
});
