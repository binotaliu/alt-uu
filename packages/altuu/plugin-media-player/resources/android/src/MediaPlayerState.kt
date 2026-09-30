package com.altuu.plugins.media_player

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex

// region Overlay State

/**
 * Media player frame in WebView-relative dp.
 */
data class MediaPlayerFrame(
    val x: Float = 0f,
    val y: Float = 0f,
    val width: Float = 320f,
    val height: Float = 200f,
)

/**
 * Data rendered by [NativeMediaPlayerOverlay].
 */
data class MediaPlayerData(
    val url: String,
    val type: String,
    val frame: MediaPlayerFrame,
    val courseName: String? = null,
    val materialName: String? = null,
    val appearance: String? = null,
)

/**
 * Plugin-owned overlay state.
 *
 * NativePHP v4 removed `NativeUIState`, so the overlay no longer piggybacks on
 * the shell's UI state. [MediaPlayerFunctions] publishes here and
 * [MediaPlayerOverlayHost] renders it; the shell only needs to mount the host
 * above the WebView (see plugin-nativephp-patch, MainActivity.kt).
 */
object MediaPlayerState {
    private val _mediaPlayerData = mutableStateOf<MediaPlayerData?>(null)
    val mediaPlayerData: State<MediaPlayerData?> = _mediaPlayerData

    fun updateMediaPlayer(data: MediaPlayerData) {
        _mediaPlayerData.value = data
    }

    fun clearMediaPlayer() {
        _mediaPlayerData.value = null
    }
}

// endregion

/**
 * Renders the media player at its WebView-relative frame, or full screen in
 * Picture-in-Picture. Mounted by the shell inside the root Box, above the WebView.
 */
@Composable
fun MediaPlayerOverlayHost(isInPiP: Boolean) {
    val mediaPlayerData by MediaPlayerState.mediaPlayerData

    mediaPlayerData?.let { data ->
        if (isInPiP) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black)
                    .zIndex(20f),
            ) {
                NativeMediaPlayerOverlay(
                    data = data,
                    isInPiP = true,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        } else {
            NativeMediaPlayerOverlay(
                data = data,
                modifier = Modifier
                    .offset(x = data.frame.x.dp, y = data.frame.y.dp)
                    .size(width = data.frame.width.dp, height = data.frame.height.dp)
                    .zIndex(20f),
            )
        }
    }
}
