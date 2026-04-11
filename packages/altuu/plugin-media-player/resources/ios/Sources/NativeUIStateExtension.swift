import Foundation

// MARK: - NativeUIState Extension for Media Player

/**
 Extension to NativeUIState to support media-player EDGE component.
 This adds mediaPlayerData property and update methods.

 Note: This extension should be merged into the main NativeUIState.swift
 by the PatchNativeUIStateCommand during build time.
 */

extension NativeUIState {

    /// Update media player state with URL and display frame
    func updateMediaPlayer(url: String, type: String, frame: MediaPlayerFrame, courseName: String? = nil, materialName: String? = nil, appearance: String? = nil, sessionContext: MediaPlayerSessionContext? = nil) {
        let mediaData = MediaPlayerData(url: url, type: type, frame: frame, courseName: courseName, materialName: materialName, appearance: appearance, sessionContext: sessionContext)
        self.mediaPlayerData = mediaData

        DebugLogger.shared.log("[NativeUIState] Media player updated: \(type) - \(url) - course: \(courseName ?? "nil") - material: \(materialName ?? "nil") - appearance: \(appearance ?? "system") - route: \(sessionContext?.routePath ?? "nil")")
    }

    /// Clear media player state
    func clearMediaPlayer() {
        self.mediaPlayerData = nil
        DebugLogger.shared.log("[NativeUIState] Media player cleared")
    }
}
