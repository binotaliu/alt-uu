<?php

use AltUU\MediaPlayer\MediaPlayer;
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

it('media player nativephp manifest registers the ios frame capture bridge function', function () {
    $manifest = json_decode(File::get(base_path('packages/altuu/plugin-media-player/nativephp.json')), true);

    $capture = collect($manifest['bridge_functions'])->firstWhere('name', 'MediaPlayer.CaptureFrame');

    expect($capture)->not->toBeNull();
    expect($capture['ios'])->toBe('MediaPlayerFunctions.CaptureFrame');
});

it('ios frame capture watermarks the student id and appends the disclaimer footer', function () {
    $source = File::get(base_path('packages/altuu/plugin-media-player/resources/ios/Sources/MediaFrameCapture.swift'));

    expect($source)
        ->toContain('class CaptureFrame: BridgeFunction')
        ->toContain('Missing studentId parameter')
        ->toContain('此截圖僅供個人保存學術使用，請遵循合理使用原則，合法使用教材，遵守智慧財產權。此截圖由 Alt UU 產生。')
        ->toContain('Int.random(in: 4...6)')
        ->toContain('UIActivityViewController');
});

it('media player nativephp manifest registers the android frame capture bridge function', function () {
    $manifest = json_decode(File::get(base_path('packages/altuu/plugin-media-player/nativephp.json')), true);

    $capture = collect($manifest['bridge_functions'])->firstWhere('name', 'MediaPlayer.CaptureFrame');

    expect($capture['android'])->toBe('com.altuu.plugins.media_player.MediaPlayerFunctions.CaptureFrame');
});

it('android frame capture copies the video surface, watermarks the student id and shares via the file provider', function () {
    $capture = File::get(base_path('packages/altuu/plugin-media-player/resources/android/src/MediaFrameCapture.kt'));
    $functions = File::get(base_path('packages/altuu/plugin-media-player/resources/android/src/MediaPlayerFunctions.kt'));
    $overlay = File::get(base_path('packages/altuu/plugin-media-player/resources/android/src/NativeMediaPlayerOverlay.kt'));

    expect($capture)
        ->toContain('PixelCopy.request')
        ->toContain('此截圖僅供個人保存學術使用，請遵循合理使用原則，合法使用教材，遵守智慧財產權。此截圖由 Alt UU 產生。')
        ->toContain('Random.nextInt(4, 7)')
        ->toContain('.fileprovider')
        ->toContain('Intent.ACTION_SEND');

    expect($functions)
        ->toContain('class CaptureFrame(private val activity: FragmentActivity) : BridgeFunction')
        ->toContain('Missing studentId parameter');

    expect($overlay)->toContain('MediaFrameCapture.registerPlayerView');
});

it('ios SetPlayer accepts a force flag that skips the same-source shortcut and resumes position', function () {
    $source = File::get(base_path('packages/altuu/plugin-media-player/resources/ios/Sources/MediaPlayerFunctions.swift'));

    expect($source)
        ->toContain('let force = (parameters["force"] as? Bool) ?? false')
        ->toContain('force: Bool = false')
        ->toContain('let isSameSource = !force &&')
        ->toContain('let resumeTime: Double?');
});

it('android SetPlayer accepts a force flag that skips the same-source shortcut and resumes position', function () {
    $source = File::get(base_path('packages/altuu/plugin-media-player/resources/android/src/MediaPlayerFunctions.kt'));

    expect($source)
        ->toContain('val force = parameters["force"] as? Boolean ?: false')
        ->toContain('force: Boolean = false')
        ->toContain('val isSameSource = !force &&')
        ->toContain('val resumePositionMs');
});

it('media player js bridge still forwards the force flag for the legacy webview shell', function () {
    $js = File::get(base_path('packages/altuu/plugin-media-player/resources/js/mediaPlayer.js'));

    expect($js)->toContain('force = false')->toContain('...(force ? { force: true } : {})');
});

it('media player php facade no longer exposes the frame based overlay and controls the element player', function () {
    $methods = get_class_methods(MediaPlayer::class);

    expect($methods)
        ->not->toContain('setPlayer')
        ->toContain('play', 'pause', 'stop', 'seek', 'getCurrentTime', 'getDuration', 'setPlaybackRate', 'getPlaybackRate', 'getState', 'captureFrame');
});

it('media player php facade is inert without a native runtime', function () {
    $player = new MediaPlayer;

    expect($player->stop('https://a/b.mp4'))->toBeNull()
        ->and($player->stop())->toBeNull()
        ->and($player->getCurrentTime())->toBe(0.0)
        ->and($player->getDuration())->toBe(0.0)
        ->and($player->getPlaybackRate())->toBe(1.0)
        ->and($player->getState())->toBeNull()
        ->and($player->captureFrame('A1'))->toBeNull();
});

it('media player manifest registers the media_player element with both renderers', function () {
    $manifest = json_decode(File::get(base_path('packages/altuu/plugin-media-player/nativephp.json')), true);

    $component = collect($manifest['components'])->firstWhere('type', 'media_player');

    expect($component)->not->toBeNull()
        ->and($component['element'])->toBe(AltUU\MediaPlayer\Elements\MediaPlayer::class)
        ->and($component['blade'])->toBe(AltUU\MediaPlayer\Components\MediaPlayer::class)
        ->and($component['ios_renderer'])->toBe('AltUUMediaPlayerRenderer')
        ->and($component['android_renderer'])->toBe('com.altuu.plugins.media_player.MediaPlayerRenderer');

    $ios = File::get(base_path('packages/altuu/plugin-media-player/resources/ios/Sources/AltUUMediaPlayerRenderer.swift'));
    $android = File::get(base_path('packages/altuu/plugin-media-player/resources/android/src/MediaPlayerRenderer.kt'));

    expect($ios)->toContain('struct AltUUMediaPlayerRenderer: View');
    expect($android)->toContain('object MediaPlayerRenderer')->toContain('fun Render(node: NativeUINode, modifier: Modifier)');
});
