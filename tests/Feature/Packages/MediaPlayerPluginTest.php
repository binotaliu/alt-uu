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

it('android media session disables skip to next and previous actions', function () {
    $source = File::get(base_path('packages/altuu/plugin-media-player/resources/android/src/MediaPlayerFunctions.kt'));

    expect($source)
        ->not->toContain('ACTION_SKIP_TO_NEXT')
        ->not->toContain('ACTION_SKIP_TO_PREVIOUS')
        ->not->toContain('onSkipToNext')
        ->not->toContain('onSkipToPrevious');
});

it('android media notification manager is configured for playback notification', function () {
    $source = File::get(base_path('packages/altuu/plugin-media-player/resources/android/src/MediaPlayerFunctions.kt'));

    expect($source)
        ->toContain('PlayerNotificationManager.Builder(')
        ->toContain('NOTIFICATION_CHANNEL_ID = "altuu_media_playback"')
        ->toContain('manager.setMediaSessionToken(it.sessionToken)')
        ->toContain('manager.setPlayer(player)');
});

it('android media notification disables prev-next and enables 10-second seek actions for audio mode', function () {
    $source = File::get(base_path('packages/altuu/plugin-media-player/resources/android/src/MediaPlayerFunctions.kt'));

    expect($source)
        ->toContain('manager.setUsePreviousAction(false)')
        ->toContain('manager.setUseNextAction(false)')
        ->toContain('manager.setUseRewindAction(showSeekActions)')
        ->toContain('manager.setUseFastForwardAction(showSeekActions)')
        ->toContain('setSeekBackIncrementMs(10_000)')
        ->toContain('setSeekForwardIncrementMs(10_000)')
        ->toContain('override fun onRewind()')
        ->toContain('override fun onFastForward()')
        ->toContain('skipBy(-10.0)')
        ->toContain('skipBy(10.0)');
});
