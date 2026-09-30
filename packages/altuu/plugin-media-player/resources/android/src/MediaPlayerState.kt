package com.altuu.plugins.media_player

// region Player data

/**
 * Frame the legacy WebView overlay used (WebView-relative dp). The `<native:media-player>` element
 * lays itself out in the screen tree, so this is always the default; it only survives as a field of
 * [MediaPlayerData] and of the `MediaPlayer.GetState` payload.
 */
data class MediaPlayerFrame(
    val x: Float = 0f,
    val y: Float = 0f,
    val width: Float = 320f,
    val height: Float = 200f,
)

/**
 * Data rendered by [NativeMediaPlayerOverlay] (the composable behind `<native:media-player>`).
 */
data class MediaPlayerData(
    val url: String,
    val type: String,
    val frame: MediaPlayerFrame,
    val courseName: String? = null,
    val materialName: String? = null,
    val appearance: String? = null,
    val poster: String? = null,
)

// endregion
