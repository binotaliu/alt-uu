import SwiftUI

// MARK: - Media Player Overlay State (LEGACY: WebView shell only)

/**
 Plugin-owned state for the native media player overlay.

 NativePHP v4 removed `NativeUIState`, so the overlay no longer piggybacks on
 the shell's UI state. `MediaPlayerFunctions` publishes here and
 `MediaPlayerOverlayHost` renders it; the shell only needs to mount the host
 above the WebView (see plugin-nativephp-patch, ContentView.swift).

 Native screens do NOT use this: `<native:media-player>` (AltUUMediaPlayerRenderer)
 draws itself in the tree and calls the manager with `publishOverlay: false`. Remove this
 file together with the shell patch when the WebView shell is dropped.
 */
final class MediaPlayerState: ObservableObject {
    static let shared = MediaPlayerState()

    @Published private(set) var mediaPlayerData: MediaPlayerData?

    private init() {}

    /// Update media player state with URL and display frame
    func updateMediaPlayer(url: String, type: String, frame: MediaPlayerFrame, courseName: String? = nil, materialName: String? = nil, appearance: String? = nil, sessionContext: MediaPlayerSessionContext? = nil) {
        mediaPlayerData = MediaPlayerData(url: url, type: type, frame: frame, courseName: courseName, materialName: materialName, appearance: appearance, sessionContext: sessionContext)

        DebugLogger.shared.log("[MediaPlayerState] Media player updated: \(type) - \(url) - course: \(courseName ?? "nil") - material: \(materialName ?? "nil") - appearance: \(appearance ?? "system") - route: \(sessionContext?.routePath ?? "nil")")
    }

    /// Clear media player state
    func clearMediaPlayer() {
        mediaPlayerData = nil
        DebugLogger.shared.log("[MediaPlayerState] Media player cleared")
    }
}

/// Renders the media player at its WebView-relative frame. Mounted by the shell above the WebView.
struct MediaPlayerOverlayHost: View {
    @ObservedObject private var state = MediaPlayerState.shared

    var body: some View {
        if let data = state.mediaPlayerData {
            NativeMediaPlayerView(data: data)
                .position(
                    x: data.frame.x + data.frame.width / 2,
                    y: data.frame.y + data.frame.height / 2
                )
                .frame(width: data.frame.width, height: data.frame.height)
        }
    }
}
