import SwiftUI

/// `<native:media-player>` (wire type `media_player`): the audio/video player as an
/// in-tree element. It is a thin SwiftUI wrapper around the shared
/// `MediaPlayerManager` (one AVPlayer per process, which the bridge functions
/// `MediaPlayer.Play|Pause|Seek|SetPlaybackRate|GetState|CaptureFrame` also control)
/// and `NativeMediaPlayerView` (AVPlayerViewController for video, custom controls
/// for audio).
///
/// Every PHP render re-sends every prop, so props are applied through
/// `MediaPlayerManager.applyElement`, which is idempotent (reload only on
/// src/kind change, start + autoplay once per load, rate only when the prop
/// changes). Events (`on_progress`, `on_state_change`, `on_ended`, `on_error`) are
/// JSON strings sent through `NativeElementBridge.sendTextChangeEvent` by the
/// manager. See docs/native-migration/conventions.md section 11.7.
///
/// NOTE: written without being compiled (no Xcode available when authored).
struct AltUUMediaPlayerRenderer: View {
    let node: NativeUINode

    var body: some View {
        let config = MediaElementConfig(node: node)
        let isAudio = config.kind == "audio"

        NativeMediaPlayerView(
            url: config.url,
            type: config.kind,
            materialName: config.title,
            courseName: config.courseName,
            appearance: config.appearance,
            poster: config.poster,
            subtitleURL: config.subtitles,
            playsOnAppear: false,
            usesNativeTheme: true
        )
        .modifier(MediaPlayerSizing(isAudio: isAudio))
        // Runs on appear and whenever a prop that matters changes.
        .task(id: config.signature) {
            await MainActor.run {
                MediaPlayerManager.shared.applyElement(config)
            }
        }
        .onDisappear {
            MediaPlayerManager.shared.detachElement(nodeId: config.nodeId)
        }
    }
}

/// Video keeps a 16:9 box for the width it is offered; audio is a fixed-height card.
private struct MediaPlayerSizing: ViewModifier {
    let isAudio: Bool

    @ViewBuilder
    func body(content: Content) -> some View {
        if isAudio {
            content.frame(height: 96)
        } else {
            content.aspectRatio(16.0 / 9.0, contentMode: .fit)
        }
    }
}
