package com.altuu.plugins.media_player

import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import androidx.fragment.app.FragmentActivity
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.nativephp.mobile.bridge.BridgeError
import com.nativephp.mobile.bridge.BridgeFunction
import com.nativephp.mobile.bridge.BridgeResponse
import com.nativephp.mobile.ui.MediaPlayerData
import com.nativephp.mobile.ui.MediaPlayerFrame
import com.nativephp.mobile.ui.NativeUIState
import org.json.JSONArray
import org.json.JSONObject

// region Data Models

data class MediaPlayerSessionContext(
    val routePath: String? = null,
    val cid: String? = null,
    val activityId: String? = null,
    val href: String? = null,
    val startedAt: String? = null
) {
    fun toMap(): Map<String, Any> {
        val map = mutableMapOf<String, Any>()
        routePath?.let { map["routePath"] = it }
        cid?.let { map["cid"] = it }
        activityId?.let { map["activityId"] = it }
        href?.let { map["href"] = it }
        startedAt?.let { map["startedAt"] = it }
        return map
    }

    companion object {
        fun fromMap(map: Map<String, Any>?): MediaPlayerSessionContext? {
            if (map == null) {
                return null
            }

            return MediaPlayerSessionContext(
                routePath = map["routePath"] as? String,
                cid = map["cid"] as? String,
                activityId = map["activityId"] as? String,
                href = map["href"] as? String,
                startedAt = map["startedAt"] as? String,
            )
        }
    }
}

// endregion

// region Media Player Manager

object MediaPlayerManager {
    private var player: ExoPlayer? = null
    private var mediaSession: MediaSession? = null
    private var currentUrl: String? = null
    private var currentType: String = "audio"
    private var currentFrame: MediaPlayerFrame = MediaPlayerFrame()
    private var currentCourseName: String? = null
    private var currentMaterialName: String? = null
    private var currentAppearance: String? = null
    private var currentSessionContext: MediaPlayerSessionContext? = null
    private var playbackSpeed: Float = 1.0f
    private var isPrepared: Boolean = false
    private val mainHandler = Handler(Looper.getMainLooper())

    fun setPlayer(
        activity: FragmentActivity,
        url: String,
        type: String,
        frame: MediaPlayerFrame,
        courseName: String?,
        materialName: String?,
        appearance: String?,
        sessionContext: MediaPlayerSessionContext?,
    ) {
        val normalizedType = type.lowercase()
        val isSameSource = currentUrl == url && currentType == normalizedType && player != null

        android.util.Log.d("MediaPlayer", "setPlayer: url=$url type=$normalizedType frame=(${frame.x},${frame.y},${frame.width}x${frame.height}) courseName=$courseName materialName=$materialName isSameSource=$isSameSource")

        if (isSameSource) {
            currentType = normalizedType
            currentFrame = frame
            currentCourseName = courseName
            currentMaterialName = materialName
            currentAppearance = appearance
            currentSessionContext = sessionContext
            syncNativeUIState()
            updateMediaSessionMetadata()
            return
        }

        // Release existing player BEFORE updating state, so releasePlayer()'s
        // internal resets don't clobber the new values we're about to set.
        releasePlayer()

        currentType = normalizedType
        currentFrame = frame
        currentCourseName = courseName
        currentMaterialName = materialName
        currentAppearance = appearance
        currentSessionContext = sessionContext

        android.util.Log.d("MediaPlayer", "setPlayer: after releasePlayer - frame=(${currentFrame.x},${currentFrame.y},${currentFrame.width}x${currentFrame.height}) courseName=$currentCourseName materialName=$currentMaterialName")

        val exoPlayer = ExoPlayer.Builder(activity)
            .build()
            .apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(C.USAGE_MEDIA)
                        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                        .build(),
                    false,
                )
                setMediaItem(MediaItem.fromUri(url))
                playWhenReady = normalizedType == "video"
                addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        if (playbackState == Player.STATE_READY) {
                            isPrepared = true
                            applyPlaybackSpeed(playbackSpeed)
                            ensureMediaSession(activity)
                            updateMediaSessionMetadata()
                            syncNativeUIState()
                            return
                        }

                        if (playbackState == Player.STATE_ENDED) {
                            updatePlaybackState(PlaybackState.STATE_STOPPED)
                            return
                        }

                        updatePlaybackStateFromPlayer()
                    }

                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        updatePlaybackStateFromPlayer()
                    }

                    override fun onPlaybackParametersChanged(playbackParameters: PlaybackParameters) {
                        playbackSpeed = playbackParameters.speed
                        updatePlaybackStateFromPlayer()
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        android.util.Log.e("MediaPlayer", "player error: ${error.message}")
                    }
                })
                prepare()
            }

        player = exoPlayer
        currentUrl = url
        syncNativeUIState()
    }

    fun play() {
        val exoPlayer = player ?: return

        exoPlayer.playWhenReady = true
        exoPlayer.play()
        applyPlaybackSpeed(playbackSpeed)
        updatePlaybackStateFromPlayer()
    }

    fun pause() {
        val exoPlayer = player ?: return

        exoPlayer.pause()
        updatePlaybackStateFromPlayer()
    }

    fun stop() {
        releasePlayer()
    }

    fun seek(timeMs: Int) {
        val exoPlayer = player ?: return

        exoPlayer.seekTo(timeMs.toLong())
        updatePlaybackStateFromPlayer()
    }

    fun skipBy(deltaSeconds: Double) {
        val exoPlayer = player ?: return
        val durationMs = exoPlayer.duration.takeUnless { it == C.TIME_UNSET || it < 0 } ?: 0L
        val targetMs = (exoPlayer.currentPosition + (deltaSeconds * 1000).toLong()).coerceIn(0L, durationMs)

        exoPlayer.seekTo(targetMs)
        updatePlaybackStateFromPlayer()
    }

    fun getCurrentTimeSeconds(): Double {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            val currentPosition = player?.currentPosition ?: return 0.0
            return currentPosition.coerceAtLeast(0L).toDouble() / 1000.0
        }

        var result = 0.0
        val latch = java.util.concurrent.CountDownLatch(1)
        mainHandler.post {
            result = player?.currentPosition?.coerceAtLeast(0L)?.toDouble()?.div(1000.0) ?: 0.0
            latch.countDown()
        }
        latch.await()
        return result
    }

    fun setPlaybackSpeed(speed: Float) {
        val clamped = speed.coerceIn(0.5f, 3.0f)
        playbackSpeed = clamped
        applyPlaybackSpeed(clamped)
    }

    fun getPlaybackSpeed(): Float = playbackSpeed

    fun getPlayer(): ExoPlayer? = player

    fun getDurationSeconds(): Double {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            val duration = player?.duration ?: return 0.0
            if (duration == C.TIME_UNSET || duration < 0) return 0.0
            return duration.toDouble() / 1000.0
        }

        var result = 0.0
        val latch = java.util.concurrent.CountDownLatch(1)
        mainHandler.post {
            val duration = player?.duration
            result = if (duration != null && duration != C.TIME_UNSET && duration >= 0) {
                duration.toDouble() / 1000.0
            } else {
                0.0
            }
            latch.countDown()
        }
        latch.await()
        return result
    }

    fun isPlaying(): Boolean {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            return player?.isPlaying == true
        }

        var result = false
        val latch = java.util.concurrent.CountDownLatch(1)
        mainHandler.post {
            result = player?.isPlaying == true
            latch.countDown()
        }
        latch.await()
        return result
    }

    fun getState(): Map<String, Any> {
        val data = mutableMapOf<String, Any>(
            "isActive" to (player != null),
            "currentTime" to getCurrentTimeSeconds(),
            "type" to currentType,
            "playbackRate" to playbackSpeed,
        )
        currentUrl?.let { data["url"] = it }
        data["frame"] = mapOf(
            "x" to currentFrame.x,
            "y" to currentFrame.y,
            "width" to currentFrame.width,
            "height" to currentFrame.height,
        )
        currentAppearance?.let { data["appearance"] = it }
        currentSessionContext?.let { data["sessionContext"] = it.toMap() }
        return data
    }

    // region Private Helpers

    private fun applyPlaybackSpeed(speed: Float) {
        val exoPlayer = player ?: return

        exoPlayer.playbackParameters = PlaybackParameters(speed)
        updatePlaybackStateFromPlayer()
    }

    private fun releasePlayer() {
        player?.release()
        player = null
        isPrepared = false
        currentUrl = null
        currentFrame = MediaPlayerFrame()
        currentCourseName = null
        currentMaterialName = null
        currentAppearance = null
        currentSessionContext = null

        mediaSession?.isActive = false
        mediaSession?.release()
        mediaSession = null

        NativeUIState.clearMediaPlayer()
    }

    private fun syncNativeUIState() {
        val url = currentUrl ?: return

        android.util.Log.d("MediaPlayer", "syncNativeUIState: url=$url type=$currentType frame=(${currentFrame.x},${currentFrame.y},${currentFrame.width}x${currentFrame.height}) courseName=$currentCourseName materialName=$currentMaterialName")

        NativeUIState.updateMediaPlayer(
            MediaPlayerData(
                url = url,
                type = currentType,
                frame = currentFrame,
                courseName = currentCourseName,
                materialName = currentMaterialName,
                appearance = currentAppearance,
            ),
        )
    }

    private fun ensureMediaSession(activity: FragmentActivity) {
        if (mediaSession != null) {
            return
        }

        val session = MediaSession(activity, "AltUUMediaPlayer")
        session.setCallback(object : MediaSession.Callback() {
            override fun onPlay() {
                mainHandler.post { play() }
            }

            override fun onPause() {
                mainHandler.post { pause() }
            }

            override fun onStop() {
                mainHandler.post { stop() }
            }

            override fun onSeekTo(pos: Long) {
                mainHandler.post { seek(pos.toInt()) }
            }

            override fun onSkipToNext() {
                mainHandler.post { skipBy(10.0) }
            }

            override fun onSkipToPrevious() {
                mainHandler.post { skipBy(-10.0) }
            }
        })
        session.isActive = true
        mediaSession = session
    }

    private fun updateMediaSessionMetadata() {
        val session = mediaSession ?: return
        val exoPlayer = player ?: return

        val builder = MediaMetadata.Builder()
        currentMaterialName?.let { builder.putString(MediaMetadata.METADATA_KEY_TITLE, it) }
        currentCourseName?.let { builder.putString(MediaMetadata.METADATA_KEY_ALBUM, it) }

        val duration = exoPlayer.duration
        if (duration != C.TIME_UNSET && duration >= 0) {
            builder.putLong(MediaMetadata.METADATA_KEY_DURATION, duration)
        }

        session.setMetadata(builder.build())
        updatePlaybackStateFromPlayer()
    }

    private fun updatePlaybackStateFromPlayer() {
        val exoPlayer = player ?: return

        val sessionState = when {
            exoPlayer.playbackState == Player.STATE_BUFFERING -> PlaybackState.STATE_BUFFERING
            exoPlayer.playbackState == Player.STATE_ENDED -> PlaybackState.STATE_STOPPED
            exoPlayer.isPlaying -> PlaybackState.STATE_PLAYING
            exoPlayer.playbackState == Player.STATE_READY -> PlaybackState.STATE_PAUSED
            else -> PlaybackState.STATE_NONE
        }

        updatePlaybackState(sessionState)
    }

    private fun updatePlaybackState(state: Int) {
        val session = mediaSession ?: return
        val position = player?.currentPosition ?: 0L

        val stateBuilder = PlaybackState.Builder()
            .setActions(
                PlaybackState.ACTION_PLAY or
                    PlaybackState.ACTION_PAUSE or
                    PlaybackState.ACTION_STOP or
                    PlaybackState.ACTION_SEEK_TO or
                    PlaybackState.ACTION_PLAY_PAUSE or
                    PlaybackState.ACTION_SKIP_TO_NEXT or
                    PlaybackState.ACTION_SKIP_TO_PREVIOUS,
            )
            .setState(state, position, playbackSpeed)

        session.setPlaybackState(stateBuilder.build())
    }

    // endregion
}

// endregion

// region Bridge Functions

object MediaPlayerFunctions {

    private fun normalizeBridgeValue(value: Any?): Any? {
        return when (value) {
            null, JSONObject.NULL -> null
            is JSONObject -> {
                val map = mutableMapOf<String, Any>()
                val keys = value.keys()
                while (keys.hasNext()) {
                    val nestedKey = keys.next()
                    val normalizedValue = normalizeBridgeValue(value.opt(nestedKey))
                    if (normalizedValue != null) {
                        map[nestedKey] = normalizedValue
                    }
                }
                map
            }
            is JSONArray -> {
                buildList {
                    for (index in 0 until value.length()) {
                        val normalizedValue = normalizeBridgeValue(value.opt(index))
                        if (normalizedValue != null) {
                            add(normalizedValue)
                        }
                    }
                }
            }
            else -> value
        }
    }

    private fun getObjectParameter(parameters: Map<String, Any>, key: String): Map<String, Any>? {
        val rawValue = normalizeBridgeValue(parameters[key]) ?: return null

        return when (rawValue) {
            is Map<*, *> -> rawValue.entries
                .mapNotNull { entry ->
                    val mapKey = entry.key as? String ?: return@mapNotNull null
                    val mapValue = entry.value ?: return@mapNotNull null
                    mapKey to mapValue
                }
                .toMap()
            else -> null
        }
    }

    private fun getFloatParameter(parameters: Map<String, Any>, key: String, fallback: Float): Float {
        return when (val value = parameters[key]) {
            is Number -> value.toFloat()
            is String -> value.toFloatOrNull() ?: fallback
            else -> fallback
        }
    }

    class SetPlayer(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val url = parameters["url"] as? String
                ?: throw BridgeError.InvalidParameters("Missing url parameter")
            val type = parameters["type"] as? String
                ?: throw BridgeError.InvalidParameters("Missing type parameter")
            val frameMap = getObjectParameter(parameters, "frame")
                ?: throw BridgeError.InvalidParameters("Missing frame parameter")

            val courseName = parameters["courseName"] as? String
            val materialName = parameters["materialName"] as? String
            val appearance = parameters["appearance"] as? String

            val frame = MediaPlayerFrame(
                x = getFloatParameter(frameMap, "x", 0f),
                y = getFloatParameter(frameMap, "y", 0f),
                width = getFloatParameter(frameMap, "width", 320f),
                height = getFloatParameter(frameMap, "height", 200f),
            )

            val sessionContext = MediaPlayerSessionContext.fromMap(
                getObjectParameter(parameters, "sessionContext"),
            )

            Handler(Looper.getMainLooper()).post {
                MediaPlayerManager.setPlayer(
                    activity,
                    url,
                    type,
                    frame,
                    courseName,
                    materialName,
                    appearance,
                    sessionContext,
                )
            }

            return BridgeResponse.success(
                mapOf(
                    "status" to "player_set",
                    "url" to url,
                    "type" to type,
                    "frame" to mapOf(
                        "x" to frame.x,
                        "y" to frame.y,
                        "width" to frame.width,
                        "height" to frame.height,
                    ),
                ),
            )
        }
    }

    class Play(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            Handler(Looper.getMainLooper()).post { MediaPlayerManager.play() }
            return BridgeResponse.success(mapOf("status" to "playing"))
        }
    }

    class Pause(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            Handler(Looper.getMainLooper()).post { MediaPlayerManager.pause() }
            return BridgeResponse.success(mapOf("status" to "paused"))
        }
    }

    class Stop(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            Handler(Looper.getMainLooper()).post { MediaPlayerManager.stop() }
            return BridgeResponse.success(mapOf("status" to "stopped"))
        }
    }

    class Seek(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val time = (parameters["time"] as? Number)?.toDouble()
                ?: throw BridgeError.InvalidParameters("Missing time parameter")

            Handler(Looper.getMainLooper()).post {
                MediaPlayerManager.seek((time * 1000).toInt())
            }

            return BridgeResponse.success(
                mapOf(
                    "status" to "seeking",
                    "time" to time,
                ),
            )
        }
    }

    class GetCurrentTime(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            return BridgeResponse.success(mapOf("time" to MediaPlayerManager.getCurrentTimeSeconds()))
        }
    }

    class SetPlaybackRate(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val rate = (parameters["rate"] as? Number)?.toFloat()
                ?: throw BridgeError.InvalidParameters("Missing rate parameter")

            Handler(Looper.getMainLooper()).post { MediaPlayerManager.setPlaybackSpeed(rate) }

            return BridgeResponse.success(
                mapOf(
                    "status" to "rate_set",
                    "rate" to rate,
                ),
            )
        }
    }

    class GetPlaybackRate(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            return BridgeResponse.success(mapOf("rate" to MediaPlayerManager.getPlaybackSpeed()))
        }
    }

    class GetState(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            return BridgeResponse.success(MediaPlayerManager.getState())
        }
    }
}

// endregion
