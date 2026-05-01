<?php

use Illuminate\Support\Facades\File;

it('media player nativephp manifest includes background_modes and info_plist for ios pip', function () {
    $manifestPath = base_path('packages/altuu/plugin-media-player/nativephp.json');

    expect(file_exists($manifestPath))->toBeTrue();

    $manifest = json_decode(File::get($manifestPath), true);

    expect(json_last_error())->toBe(JSON_ERROR_NONE);
    expect($manifest['name'])->toBe('altuu/plugin-media-player');

    expect($manifest['ios'])->toBeArray();
    expect($manifest['ios']['background_modes'])->toBeArray();
    expect($manifest['ios']['background_modes'])->toContain('audio');

    expect($manifest['ios']['info_plist'])->toBeArray();
    expect($manifest['ios']['info_plist']['UIBackgroundModes'])->toBeArray();
    expect($manifest['ios']['info_plist']['UIBackgroundModes'])->toContain('audio');
});

it('media player nativephp manifest includes playback rate bridge functions', function () {
    $manifestPath = base_path('packages/altuu/plugin-media-player/nativephp.json');

    expect(file_exists($manifestPath))->toBeTrue();

    $manifest = json_decode(File::get($manifestPath), true);

    expect(json_last_error())->toBe(JSON_ERROR_NONE);
    expect(array_column($manifest['bridge_functions'], 'name'))->toContain('MediaPlayer.SetPlaybackRate');
    expect(array_column($manifest['bridge_functions'], 'name'))->toContain('MediaPlayer.GetPlaybackRate');
});

it('media player nativephp manifest includes restore state bridge function', function () {
    $manifestPath = base_path('packages/altuu/plugin-media-player/nativephp.json');

    expect(file_exists($manifestPath))->toBeTrue();

    $manifest = json_decode(File::get($manifestPath), true);

    expect(json_last_error())->toBe(JSON_ERROR_NONE);
    expect(array_column($manifest['bridge_functions'], 'name'))->toContain('MediaPlayer.GetState');
});

it('media player nativephp manifest includes android media3 dependencies', function () {
    $manifestPath = base_path('packages/altuu/plugin-media-player/nativephp.json');

    expect(file_exists($manifestPath))->toBeTrue();

    $manifest = json_decode(File::get($manifestPath), true);

    expect(json_last_error())->toBe(JSON_ERROR_NONE);
    expect($manifest['android'])->toBeArray();
    expect($manifest['android']['dependencies'])->toBeArray();
    expect($manifest['android']['dependencies']['implementation'])->toContain(
        'androidx.media3:media3-exoplayer:1.5.1',
        'androidx.media3:media3-exoplayer-hls:1.5.1',
        'androidx.media3:media3-ui:1.5.1',
    );
});

it('android video fullscreen uses a dedicated fullscreen overlay instead of only rotating the activity', function () {
    $source = File::get(base_path('packages/altuu/plugin-media-player/resources/android/src/NativeMediaPlayerOverlay.kt'));

    expect($source)
        ->toContain('BackHandler(enabled = isFullscreen)')
        ->toContain('Dialog(')
        ->toContain('usePlatformDefaultWidth = false')
        ->toContain('WindowCompat.setDecorFitsSystemWindows(window, !isFullscreen)')
        ->not->toContain('private fun Activity.toggleFullscreenMode(currentlyFullscreen: Boolean)');
});
