package com.altuu.plugins.media_player

import android.content.Context
import android.content.ContextWrapper
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import com.nativephp.mobile.ui.nativerender.NativeUINode
import org.json.JSONObject

/**
 * `<native:media-player>` (wire type `media_player`): the audio/video player as an in-tree
 * element. A thin Compose wrapper around the shared [MediaPlayerManager] (one ExoPlayer per
 * process, which the bridge functions MediaPlayer.Play|Pause|Seek|SetPlaybackRate|GetState|
 * CaptureFrame also control) and [NativeMediaPlayerOverlay] (PlayerView for video, custom
 * controls for audio; the name is historical, it is no longer an overlay).
 *
 * Every PHP render re-sends every prop, so props go through [MediaPlayerManager.applyElement],
 * which is idempotent (reload only on src/kind change, start + autoplay once per load, rate
 * only when the prop changes). Events (`on_progress`, `on_state_change`, `on_ended`,
 * `on_error`) are JSON strings sent by the manager via NativeUIBridge.sendTextChangeEvent.
 * See docs/native-migration/conventions.md section 11.7.
 *
 * NOTE: written without being compiled (no Android toolchain when authored).
 */
object MediaPlayerRenderer {

    @Composable
    fun Render(node: NativeUINode, modifier: Modifier) {
        val config = MediaElementConfig.from(node)
        val context = LocalContext.current
        val activity = remember(context) { context.findFragmentActivity() }

        // Runs on first composition and whenever a prop that matters changes.
        LaunchedEffect(config.signature) {
            activity?.let { MediaPlayerManager.applyElement(it, config) }
        }

        DisposableEffect(config.nodeId) {
            onDispose { MediaPlayerManager.detachElement(config.nodeId) }
        }

        val data = MediaPlayerData(
            url = config.url,
            type = config.kind,
            frame = MediaPlayerFrame(),
            courseName = config.courseName,
            materialName = config.title,
            appearance = config.appearance,
            poster = config.poster,
        )

        // Video keeps a 16:9 box for the width it is given; audio is a fixed-height card.
        val sized = if (config.kind == "audio") {
            modifier.fillMaxWidth().height(96.dp)
        } else {
            modifier.fillMaxWidth().aspectRatio(16f / 9f)
        }

        NativeMediaPlayerOverlay(
            data = data,
            modifier = sized,
            useNativeTheme = true,
        )
    }
}

/** Everything `<native:media-player>` sends, parsed once per composition. */
data class MediaElementConfig(
    val nodeId: Int,
    val url: String,
    val kind: String,
    val title: String?,
    val courseName: String?,
    val poster: String?,
    val subtitles: String?,
    val start: Double?,
    val rate: Float,
    val appearance: String?,
    val watermark: String?,
    val autoplay: Boolean,
    val sessionContext: MediaPlayerSessionContext?,
    val progressId: Int,
    val stateChangeId: Int,
    val endedId: Int,
    val errorId: Int,
) {
    /** Identity of everything that should re-run [MediaPlayerManager.applyElement]. */
    val signature: String
        get() = listOf(
            url, kind, title.orEmpty(), courseName.orEmpty(), (start ?: 0.0).toString(), rate.toString(),
            appearance.orEmpty(), watermark.orEmpty(), autoplay.toString(), subtitles.orEmpty(),
            "$progressId|$stateChangeId|$endedId|$errorId|$nodeId",
        ).joinToString("\u001F")

    companion object {
        fun from(node: NativeUINode): MediaElementConfig {
            fun optional(key: String): String? = node.props.getString(key, "").takeIf { it.isNotEmpty() }

            val startSeconds = node.props.getFloat("start", 0f).toDouble()

            return MediaElementConfig(
                nodeId = node.id,
                url = node.props.getString("src", ""),
                kind = if (node.props.getString("kind", "video") == "audio") "audio" else "video",
                title = optional("title"),
                courseName = optional("course_name"),
                poster = optional("poster"),
                subtitles = optional("subtitles"),
                start = startSeconds.takeIf { it > 0.0 },
                rate = node.props.getFloat("rate", 1f),
                appearance = optional("appearance"),
                watermark = optional("watermark"),
                autoplay = node.props.getBool("autoplay", false),
                sessionContext = parseSessionContext(optional("session_context")),
                progressId = node.props.getCallbackId("on_progress"),
                stateChangeId = node.props.getCallbackId("on_state_change"),
                endedId = node.props.getCallbackId("on_ended"),
                errorId = node.props.getCallbackId("on_error"),
            )
        }

        private fun parseSessionContext(raw: String?): MediaPlayerSessionContext? {
            if (raw == null) {
                return null
            }

            return try {
                val json = JSONObject(raw)

                fun field(key: String): String? = if (json.has(key) && !json.isNull(key)) json.getString(key) else null

                MediaPlayerSessionContext(
                    routePath = field("routePath"),
                    cid = field("cid"),
                    activityId = field("activityId"),
                    href = field("href"),
                    startedAt = field("startedAt"),
                )
            } catch (error: Exception) {
                null
            }
        }
    }
}

private fun Context.findFragmentActivity(): FragmentActivity? {
    var current = this

    while (current is ContextWrapper) {
        if (current is FragmentActivity) {
            return current
        }

        current = current.baseContext
    }

    return null
}
