package com.altuu.plugins.media_player

import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import androidx.compose.runtime.mutableIntStateOf
import androidx.fragment.app.FragmentActivity
import androidx.media3.common.AudioAttributes
import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.nativephp.mobile.bridge.BridgeError
import com.nativephp.mobile.bridge.BridgeFunction
import com.nativephp.mobile.bridge.BridgeResponse
import com.nativephp.mobile.ui.nativerender.NativeUIBridge
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

    // region `<native:media-player>` element state

    /**
     * Bumped whenever the ExoPlayer instance is created or released. Composables read it
     * so a PlayerView built before the player existed re-binds instead of staying blank.
     */
    private val playerRevisionState = mutableIntStateOf(0)
    val playerRevision: Int get() = playerRevisionState.intValue

    /** Text the element's `watermark` prop stamps on captured frames. */
    var watermarkText: String? = null
        private set

    val currentCourseNameValue: String? get() = currentCourseName
    val currentMaterialNameValue: String? get() = currentMaterialName

    private var appliedSourceKey: String? = null
    private var appliedRateProp: Float? = null
    private var lastEmittedState: String? = null
    private var lastProgressEmitMs: Long = 0L

    // endregion

    /**
     * Builds (or reuses) the shared player. Returns true when a new player was built.
     * `autoplay = null` keeps the default (video plays, audio waits).
     */
    fun setPlayer(
        activity: FragmentActivity,
        url: String,
        type: String,
        frame: MediaPlayerFrame,
        courseName: String?,
        materialName: String?,
        appearance: String?,
        sessionContext: MediaPlayerSessionContext?,
        force: Boolean = false,
        subtitleUrl: String? = null,
        startPositionMs: Long = 0L,
        autoplay: Boolean? = null,
    ): Boolean {
        if (activity.isFinishing || activity.isDestroyed) {
            // The Activity reference captured when this bridge call was
            // dispatched no longer backs a live screen (e.g. it was
            // recreated between the request being queued and this Handler
            // callback running). Building an ExoPlayer against it would be
            // meaningless at best and crash at worst, so drop the request
            // instead of touching the currently active player.
            android.util.Log.w("MediaPlayer", "setPlayer: ignoring request against a finishing/destroyed activity for url=$url")
            return false
        }

        val normalizedType = type.lowercase()
        val isSameSource = !force && currentUrl == url && currentType == normalizedType && player != null

        // A forced reload (e.g. after a network failure) rebuilds the player
        // from scratch but resumes from where the previous one stopped.
        val resumePositionMs = if (force && currentUrl == url) {
            player?.currentPosition?.coerceAtLeast(0L) ?: 0L
        } else {
            0L
        }
        val shouldResumePlayback = force && player?.playWhenReady == true

        android.util.Log.d("MediaPlayer", "setPlayer: url=$url type=$normalizedType frame=(${frame.x},${frame.y},${frame.width}x${frame.height}) courseName=$courseName materialName=$materialName isSameSource=$isSameSource")

        if (isSameSource) {
            currentType = normalizedType
            currentFrame = frame
            currentCourseName = courseName
            currentMaterialName = materialName
            currentAppearance = appearance
            currentSessionContext = sessionContext
            updateMediaSessionMetadata()
            return false
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

        val mediaItem = MediaItem.Builder()
            .setUri(url)
            .apply {
                if (!subtitleUrl.isNullOrBlank() && normalizedType == "video") {
                    setSubtitleConfigurations(
                        listOf(
                            MediaItem.SubtitleConfiguration.Builder(Uri.parse(subtitleUrl))
                                .setMimeType(MimeTypes.TEXT_VTT)
                                .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
                                .build(),
                        ),
                    )
                }
            }
            .build()
        val initialPositionMs = if (resumePositionMs > 0L) resumePositionMs else startPositionMs

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
                if (initialPositionMs > 0L) {
                    setMediaItem(mediaItem, initialPositionMs)
                } else {
                    setMediaItem(mediaItem)
                }
                playWhenReady = autoplay ?: (normalizedType == "video" || shouldResumePlayback)
                addListener(elementListener)
                addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        if (playbackState == Player.STATE_READY) {
                            isPrepared = true
                            applyPlaybackSpeed(playbackSpeed)
                            ensureMediaSession(activity)
                            updateMediaSessionMetadata()
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
        lastEmittedState = null
        playerRevisionState.intValue += 1

        return true
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

    fun stop(expectedUrl: String? = null) {
        if (expectedUrl != null && expectedUrl != currentUrl) {
            // A newer setPlayer() call already superseded this stop request
            // (e.g. it arrived late after the user navigated to another
            // material); releasing now would tear down the new player.
            android.util.Log.d("MediaPlayer", "stop: ignoring stale stop for $expectedUrl (current=$currentUrl)")
            return
        }

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
            "duration" to getDurationSeconds(),
            "state" to currentStateName(),
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

    // region `<native:media-player>` element integration

    /**
     * Applies the element's props. Idempotent: every PHP render re-sends every prop, so the
     * source only reloads when url/kind change, start + autoplay only apply to a freshly
     * built player, and the rate only when the PROP changed (a rate picked in the native
     * controls is never overwritten by a later render).
     */
    fun applyElement(activity: FragmentActivity, config: MediaElementConfig) {
        MediaElementEvents.bind(config)
        watermarkText = config.watermark

        val key = "${config.url}|${config.kind}"

        if (key != appliedSourceKey || player == null) {
            val built = setPlayer(
                activity = activity,
                url = config.url,
                type = config.kind,
                frame = MediaPlayerFrame(),
                courseName = config.courseName,
                materialName = config.title,
                appearance = config.appearance,
                sessionContext = config.sessionContext,
                subtitleUrl = config.subtitles,
                startPositionMs = ((config.start ?: 0.0) * 1000).toLong(),
                autoplay = config.autoplay,
            )

            if (built || player != null) {
                appliedSourceKey = key
                appliedRateProp = null
            }
        } else if (currentCourseName != config.courseName || currentMaterialName != config.title) {
            currentCourseName = config.courseName
            currentMaterialName = config.title
            updateMediaSessionMetadata()
        }

        if (appliedRateProp != config.rate) {
            appliedRateProp = config.rate
            setPlaybackSpeed(config.rate)
        }

        if (player != null) {
            startProgressTicker()
        }
    }

    /**
     * The element left the composition. Only pause and mute its events: Compose also
     * disposes views while recomposing them, so the real stop is PHP's
     * (`MediaPlayback::unmount()` calls MediaPlayer.Stop with the URL).
     */
    fun detachElement(nodeId: Int) {
        if (MediaElementEvents.nodeId != nodeId) {
            return
        }

        stopProgressTicker()
        pause()
        MediaElementEvents.clear()
    }

    fun currentStateName(): String {
        val exoPlayer = player ?: return "idle"

        return when {
            exoPlayer.playbackState == Player.STATE_ENDED -> "ended"
            exoPlayer.playbackState == Player.STATE_BUFFERING -> "buffering"
            exoPlayer.isPlaying -> "playing"
            exoPlayer.playbackState == Player.STATE_READY -> "paused"
            else -> "idle"
        }
    }

    private val elementListener = object : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            emitStateIfChanged()

            if (playbackState == Player.STATE_ENDED) {
                emitProgress()
                MediaElementEvents.send(MediaElementEvents.endedId, timingPayload())
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            emitStateIfChanged()
        }

        override fun onPositionDiscontinuity(
            oldPosition: Player.PositionInfo,
            newPosition: Player.PositionInfo,
            reason: Int,
        ) {
            if (reason == Player.DISCONTINUITY_REASON_SEEK) {
                emitProgress()
            }
        }

        override fun onPlayerError(error: PlaybackException) {
            MediaElementEvents.send(
                MediaElementEvents.errorId,
                JSONObject().put("message", error.message ?: "無法播放此媒體").put("code", error.errorCode),
            )
        }
    }

    private val progressTicker = object : Runnable {
        override fun run() {
            emitProgressIfDue()
            mainHandler.postDelayed(this, 1000L)
        }
    }

    private fun startProgressTicker() {
        mainHandler.removeCallbacks(progressTicker)
        mainHandler.postDelayed(progressTicker, 1000L)
    }

    private fun stopProgressTicker() {
        mainHandler.removeCallbacks(progressTicker)
    }

    private fun timingPayload(): JSONObject = JSONObject()
        .put("currentTime", getCurrentTimeSeconds())
        .put("duration", getDurationSeconds())

    private fun emitStateIfChanged() {
        val state = currentStateName()

        if (state == lastEmittedState) {
            return
        }

        lastEmittedState = state
        MediaElementEvents.send(MediaElementEvents.stateChangeId, timingPayload().put("state", state))

        // A pause is the moment a study timer wants an up-to-date position.
        if (state == "paused") {
            emitProgress()
        }
    }

    /** `progress` while playing, at most every 5 seconds (each event costs a PHP render). */
    private fun emitProgressIfDue() {
        if (MediaElementEvents.progressId == 0 || currentStateName() != "playing") {
            return
        }

        if (android.os.SystemClock.elapsedRealtime() - lastProgressEmitMs >= 5000L) {
            emitProgress()
        }
    }

    private fun emitProgress() {
        if (MediaElementEvents.progressId == 0 || player == null) {
            return
        }

        lastProgressEmitMs = android.os.SystemClock.elapsedRealtime()
        MediaElementEvents.send(MediaElementEvents.progressId, timingPayload().put("state", currentStateName()))
    }

    // endregion

    // region Private Helpers

    private fun applyPlaybackSpeed(speed: Float) {
        val exoPlayer = player ?: return

        exoPlayer.playbackParameters = PlaybackParameters(speed)
        updatePlaybackStateFromPlayer()
    }

    private fun releasePlayer() {
        stopProgressTicker()
        player?.release()
        player = null
        appliedSourceKey = null
        appliedRateProp = null
        lastEmittedState = null
        playerRevisionState.intValue += 1
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

// region Element events

/** Text-payload (JSON) event dispatch to the element that owns the player, like html-view. */
object MediaElementEvents {
    @Volatile var nodeId: Int = 0
        private set
    @Volatile var progressId: Int = 0
        private set
    @Volatile var stateChangeId: Int = 0
        private set
    @Volatile var endedId: Int = 0
        private set
    @Volatile var errorId: Int = 0
        private set

    fun bind(config: MediaElementConfig) {
        nodeId = config.nodeId
        progressId = config.progressId
        stateChangeId = config.stateChangeId
        endedId = config.endedId
        errorId = config.errorId
    }

    fun clear() {
        nodeId = 0
        progressId = 0
        stateChangeId = 0
        endedId = 0
        errorId = 0
    }

    fun send(callbackId: Int, payload: JSONObject) {
        if (callbackId == 0) {
            return
        }

        NativeUIBridge.sendTextChangeEvent(callbackId, nodeId, payload.toString())
    }
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
            val expectedUrl = parameters["url"] as? String

            Handler(Looper.getMainLooper()).post { MediaPlayerManager.stop(expectedUrl) }
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
            return BridgeResponse.success(
                mapOf(
                    "time" to MediaPlayerManager.getCurrentTimeSeconds(),
                    "duration" to MediaPlayerManager.getDurationSeconds(),
                ),
            )
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

    class CaptureFrame(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            // Legacy callers pass studentId; the element's `watermark` prop is the fallback.
            val studentId = (parameters["studentId"] as? String)?.takeIf { it.isNotBlank() }
                ?: MediaPlayerManager.watermarkText?.takeIf { it.isNotBlank() }
                ?: throw BridgeError.InvalidParameters("Missing studentId parameter")

            val seconds = MediaFrameCapture.captureAndShare(
                activity = activity,
                studentId = studentId,
                courseName = (parameters["courseName"] as? String) ?: MediaPlayerManager.currentCourseNameValue,
                materialName = (parameters["materialName"] as? String) ?: MediaPlayerManager.currentMaterialNameValue,
            )

            return BridgeResponse.success(
                mapOf(
                    "status" to "captured",
                    "time" to seconds,
                ),
            )
        }
    }

    class GetState(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            return BridgeResponse.success(MediaPlayerManager.getState())
        }
    }
}

// endregion
