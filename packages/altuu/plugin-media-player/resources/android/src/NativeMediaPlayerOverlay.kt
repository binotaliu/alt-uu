package com.altuu.plugins.media_player

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.pm.ActivityInfo
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.PackageManager
import android.graphics.Color as AndroidColor
import android.os.Build
import android.util.Rational
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.nativephp.mobile.ui.MaterialIcon
import com.nativephp.mobile.ui.MediaPlayerData
import kotlinx.coroutines.delay
import java.util.Locale

private val ThemeColor = Color(0xFFF0804E)
private val ThemeColorDark = Color(0xFFC25733)
private val AudioLightGradient = listOf(Color(0xFFFFF4EC), Color(0xFFFFE2D1))
private val AudioDarkGradient = listOf(Color(0xFF30221C), Color(0xFF1F1814))
private val PlaybackRateOptions = listOf(0.75f, 1.0f, 1.25f, 1.5f, 2.0f)

@Composable
fun NativeMediaPlayerOverlay(data: MediaPlayerData, modifier: Modifier = Modifier, isInPiP: Boolean = false) {
    var isPlaying by remember(data.url, data.type) { mutableStateOf(MediaPlayerManager.isPlaying()) }
    var currentTime by remember(data.url, data.type) { mutableFloatStateOf(MediaPlayerManager.getCurrentTimeSeconds().toFloat()) }
    var duration by remember(data.url, data.type) { mutableFloatStateOf(MediaPlayerManager.getDurationSeconds().toFloat()) }
    var playbackSpeed by remember(data.url, data.type) { mutableFloatStateOf(MediaPlayerManager.getPlaybackSpeed()) }

    LaunchedEffect(data.url, data.type) {
        while (true) {
            isPlaying = MediaPlayerManager.isPlaying()
            currentTime = MediaPlayerManager.getCurrentTimeSeconds().toFloat()
            duration = MediaPlayerManager.getDurationSeconds().toFloat().coerceAtLeast(0f)
            playbackSpeed = MediaPlayerManager.getPlaybackSpeed()
            delay(300)
        }
    }

    if (data.type.lowercase(Locale.US) == "audio") {
        AudioOverlayContent(
            data = data,
            isPlaying = isPlaying,
            currentTime = currentTime,
            duration = duration,
            playbackSpeed = playbackSpeed,
            modifier = modifier,
        )
    } else {
        VideoOverlayContent(
            data = data,
            isPlaying = isPlaying,
            playbackSpeed = playbackSpeed,
            isInPiP = isInPiP,
            modifier = modifier,
        )
    }
}

@Composable
private fun AudioOverlayContent(
    data: MediaPlayerData,
    isPlaying: Boolean,
    currentTime: Float,
    duration: Float,
    playbackSpeed: Float,
    modifier: Modifier,
) {
    val themeColor = if (MaterialTheme.colorScheme.surface.luminance() < 0.5f) ThemeColorDark else ThemeColor
    val gradient = if (MaterialTheme.colorScheme.surface.luminance() < 0.5f) AudioDarkGradient else AudioLightGradient
    var isSeeking by remember { mutableStateOf(false) }
    var seekPosition by remember { mutableFloatStateOf(0f) }

    Card(
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Brush.linearGradient(gradient))
                .padding(horizontal = 14.dp, vertical = 12.dp),
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text(
                            text = data.materialName ?: "語音課程",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = themeColor,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )

                        Text(
                            text = data.courseName ?: "原生音訊播放器",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }

                    PlaybackRateMenuButton(
                        playbackSpeed = playbackSpeed,
                        themeColor = themeColor,
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    PlayPauseButton(isPlaying = isPlaying, themeColor = themeColor)

                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(top = 2.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Slider(
                            value = if (isSeeking) seekPosition else currentTime,
                            onValueChange = { value ->
                                isSeeking = true
                                seekPosition = value
                            },
                            onValueChangeFinished = {
                                isSeeking = false
                                MediaPlayerManager.seek((seekPosition * 1000).toInt())
                            },
                            valueRange = 0f..maxOf(duration, 1f),
                            modifier = Modifier.fillMaxWidth().height(18.dp),
                            colors = SliderDefaults.colors(
                                thumbColor = themeColor,
                                activeTrackColor = themeColor,
                                inactiveTrackColor = themeColor.copy(alpha = 0.18f),
                            ),
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(
                                text = formatDuration(if (isSeeking) seekPosition.toDouble() else currentTime.toDouble()),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Text(
                                text = formatDuration(duration.toDouble()),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun VideoOverlayContent(
    data: MediaPlayerData,
    isPlaying: Boolean,
    playbackSpeed: Float,
    isInPiP: Boolean,
    modifier: Modifier,
) {
    val context = LocalContext.current
    val themeColor = if (MaterialTheme.colorScheme.surface.luminance() < 0.5f) ThemeColorDark else ThemeColor
    val activity = remember(context) { context.findActivity() }
    val supportsPip = remember(activity) { activity?.supportsPictureInPicture() == true }
    var isFullscreen by remember(data.url, data.type) { mutableStateOf(false) }
    var areControlsVisible by remember(data.url, data.type, isFullscreen) { mutableStateOf(false) }

    BackHandler(enabled = isFullscreen) {
        isFullscreen = false
    }

    LaunchedEffect(isInPiP) {
        if (isInPiP) {
            isFullscreen = false
        }
    }

    DisposableEffect(activity, isPlaying) {
        val currentActivity = activity
        val window = currentActivity?.window

        if (window != null) {
            if (isPlaying) {
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }

        onDispose {
            window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    DisposableEffect(activity, isFullscreen) {
        val currentActivity = activity
        val window = currentActivity?.window

        currentActivity?.requestedOrientation = if (isFullscreen) {
            ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        } else {
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        }

        if (window != null) {
            WindowCompat.setDecorFitsSystemWindows(window, !isFullscreen)
        }

        onDispose {
            currentActivity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            if (window != null) {
                WindowCompat.setDecorFitsSystemWindows(window, true)
            }
        }
    }

    DisposableEffect(activity, isFullscreen, areControlsVisible) {
        val currentActivity = activity
        val window = currentActivity?.window
        val decorView = window?.decorView
        val controller = if (window != null && decorView != null) {
            WindowCompat.getInsetsController(window, decorView)
        } else {
            null
        }
        val previousBehavior = controller?.systemBarsBehavior

        if (isFullscreen && !areControlsVisible) {
            controller?.hide(WindowInsetsCompat.Type.systemBars())
            controller?.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        } else if (isFullscreen && areControlsVisible) {
            controller?.show(WindowInsetsCompat.Type.systemBars())
            if (previousBehavior != null) {
                controller?.systemBarsBehavior = previousBehavior
            }
        } else {
            controller?.show(WindowInsetsCompat.Type.systemBars())
            if (previousBehavior != null) {
                controller?.systemBarsBehavior = previousBehavior
            }
        }

        onDispose {
            controller?.show(WindowInsetsCompat.Type.systemBars())
            if (previousBehavior != null) {
                controller?.systemBarsBehavior = previousBehavior
            }
        }
    }

    DisposableEffect(activity, isFullscreen) {
        val currentActivity = activity
        val window = currentActivity?.window

        currentActivity?.requestedOrientation = if (isFullscreen) {
            ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        } else {
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        }

        onDispose {
            currentActivity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        }
    }

    if (isFullscreen) {
        Dialog(
            onDismissRequest = { isFullscreen = false },
            properties = DialogProperties(
                usePlatformDefaultWidth = false,
                decorFitsSystemWindows = false,
            ),
        ) {
            VideoPlayerSurface(
                data = data,
                playbackSpeed = playbackSpeed,
                isInPiP = isInPiP,
                isFullscreen = true,
                supportsPip = supportsPip,
                themeColor = themeColor,
                modifier = Modifier.fillMaxSize(),
                onToggleFullscreen = { isFullscreen = false },
                onControlsVisibilityChanged = { visible ->
                    areControlsVisible = visible
                },
                onEnterPip = { playerView ->
                    activity?.enterPictureInPicture(playerView)
                    isFullscreen = false
                },
            )
        }

        return
    }

    VideoPlayerSurface(
        data = data,
        playbackSpeed = playbackSpeed,
        isInPiP = isInPiP,
        isFullscreen = false,
        supportsPip = supportsPip,
        themeColor = themeColor,
        modifier = modifier,
        onToggleFullscreen = { isFullscreen = true },
        onControlsVisibilityChanged = { visible ->
            areControlsVisible = visible
        },
        onEnterPip = { playerView ->
            activity?.enterPictureInPicture(playerView)
        },
    )
}

@Composable
private fun VideoPlayerSurface(
    data: MediaPlayerData,
    playbackSpeed: Float,
    isInPiP: Boolean,
    isFullscreen: Boolean,
    supportsPip: Boolean,
    themeColor: Color,
    modifier: Modifier,
    onToggleFullscreen: () -> Unit,
    onControlsVisibilityChanged: (Boolean) -> Unit,
    onEnterPip: (PlayerView?) -> Unit,
) {
    var isTopOverlayVisible by remember(data.url, data.type, isFullscreen) { mutableStateOf(false) }
    var playerViewRef by remember(data.url, data.type, isFullscreen) { mutableStateOf<PlayerView?>(null) }

    Card(
        modifier = modifier,
        shape = if (isFullscreen) RoundedCornerShape(0.dp) else RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Black),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isFullscreen) 0.dp else 4.dp),
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            AndroidView(
                factory = { context ->
                    PlayerView(context).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT,
                        )
                        useController = true
                        controllerAutoShow = true
                        controllerShowTimeoutMs = 2500
                        resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                        setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS)
                        setBackgroundColor(AndroidColor.BLACK)
                        hideSettingsButton()
                        setControllerVisibilityListener(
                            PlayerView.ControllerVisibilityListener { visibility ->
                                isTopOverlayVisible = visibility == View.VISIBLE
                                onControlsVisibilityChanged(visibility == View.VISIBLE)
                            },
                        )
                        player = MediaPlayerManager.getPlayer()
                        playerViewRef = this
                        isTopOverlayVisible = isControllerFullyVisible
                        onControlsVisibilityChanged(isControllerFullyVisible)
                    }
                },
                update = { playerView ->
                    playerView.player = MediaPlayerManager.getPlayer()
                    playerViewRef = playerView
                    playerView.useController = !isInPiP
                    playerView.hideSettingsButton()
                    isTopOverlayVisible = !isInPiP && playerView.isControllerFullyVisible
                    onControlsVisibilityChanged(isTopOverlayVisible)
                },
                modifier = Modifier.fillMaxSize(),
            )

            if (!isInPiP) {
                androidx.compose.animation.AnimatedVisibility(
                    visible = isTopOverlayVisible,
                    enter = fadeIn(),
                    exit = fadeOut(),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(Color.Black.copy(alpha = 0.68f), Color.Transparent),
                                ),
                            )
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.Top,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Column(
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(2.dp),
                            ) {
                                Text(
                                    text = data.materialName ?: "影片課程",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color.White,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                Text(
                                    text = data.courseName ?: "原生影片播放器",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = Color.White.copy(alpha = 0.8f),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                    }
                }

                androidx.compose.animation.AnimatedVisibility(
                    visible = isTopOverlayVisible,
                    enter = fadeIn(),
                    exit = fadeOut(),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(14.dp),
                    ) {
                        Row(
                            modifier = Modifier.align(Alignment.BottomEnd),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            PlaybackRateMenuButton(
                                playbackSpeed = playbackSpeed,
                                themeColor = themeColor,
                                filled = false,
                            )

                            if (supportsPip) {
                                VideoPipButton(
                                    onClick = {
                                        onEnterPip(playerViewRef)
                                    },
                                )
                            }

                            VideoFullscreenButton(
                                isFullscreen = isFullscreen,
                                onClick = onToggleFullscreen,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PlayPauseButton(isPlaying: Boolean, themeColor: Color) {
    Box(
        modifier = Modifier
            .size(38.dp)
            .clip(CircleShape)
            .background(themeColor)
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() },
            ) {
                if (isPlaying) {
                    MediaPlayerManager.pause()
                } else {
                    MediaPlayerManager.play()
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        MaterialIcon(
            name = if (isPlaying) "pause" else "play_arrow",
            contentDescription = if (isPlaying) "暫停" else "播放",
            size = 20.dp,
            tint = Color.White,
        )
    }
}

@Composable
private fun VideoPipButton(onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .sizeIn(minWidth = 32.dp, minHeight = 32.dp)
            .clip(CircleShape)
            .background(Color.Black.copy(alpha = 0.35f))
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() },
                onClick = onClick,
            )
            .padding(horizontal = 8.dp, vertical = 7.dp),
        contentAlignment = Alignment.Center,
    ) {
        MaterialIcon(
            name = "picture_in_picture_alt",
            contentDescription = "子母畫面",
            size = 18.dp,
            tint = Color.White,
        )
    }
}

@Composable
private fun VideoFullscreenButton(
    isFullscreen: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .sizeIn(minWidth = 32.dp, minHeight = 32.dp)
            .clip(CircleShape)
            .background(Color.Black.copy(alpha = 0.35f))
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() },
                onClick = onClick,
            )
            .padding(horizontal = 8.dp, vertical = 7.dp),
        contentAlignment = Alignment.Center,
    ) {
        MaterialIcon(
            name = if (isFullscreen) "fullscreen_exit" else "fullscreen",
            contentDescription = if (isFullscreen) "離開全螢幕" else "全螢幕",
            size = 18.dp,
            tint = Color.White,
        )
    }
}

@Composable
private fun PlaybackRateMenuButton(playbackSpeed: Float, themeColor: Color, filled: Boolean = true) {
    var isExpanded by remember { mutableStateOf(false) }
    val backgroundColor = if (filled) themeColor else Color.Black.copy(alpha = 0.35f)
    val textColor = Color.White

    Box {
        Text(
            text = formatRate(playbackSpeed),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = textColor,
            modifier = Modifier
                .clip(CircleShape)
                .background(backgroundColor)
                .clickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() },
                ) {
                    isExpanded = true
                }
                .padding(horizontal = 10.dp, vertical = 7.dp),
        )

        DropdownMenu(
            expanded = isExpanded,
            onDismissRequest = { isExpanded = false },
        ) {
            PlaybackRateOptions.forEach { rate ->
                DropdownMenuItem(
                    text = {
                        Text(
                            text = formatRate(rate),
                            fontWeight = if (kotlin.math.abs(rate - playbackSpeed) < 0.01f) FontWeight.Bold else FontWeight.Normal,
                        )
                    },
                    onClick = {
                        MediaPlayerManager.setPlaybackSpeed(rate)
                        isExpanded = false
                    },
                )
            }
        }
    }
}

private fun Context.findActivity(): Activity? {
    var currentContext = this
    while (currentContext is ContextWrapper) {
        if (currentContext is Activity) {
            return currentContext
        }

        currentContext = currentContext.baseContext
    }

    return null
}

private fun Activity.supportsPictureInPicture(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        return false
    }

    return packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)
}

private fun Activity.enterPictureInPicture(playerView: PlayerView?) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        return
    }

    val width = playerView?.width?.takeIf { it > 0 } ?: 16
    val height = playerView?.height?.takeIf { it > 0 } ?: 9
    val params = PictureInPictureParams.Builder()
        .setAspectRatio(Rational(width, height))
        .build()

    enterPictureInPictureMode(params)
}

private fun PlayerView.hideSettingsButton() {
    val controllerId = resources.getIdentifier("exo_controller", "id", context.packageName)
    if (controllerId == 0) {
        return
    }

    val controllerView = findViewById<View>(controllerId) ?: return
    val candidateIds = listOf("exo_settings", "exo_overflow_show")

    candidateIds.forEach { idName ->
        val targetId = resources.getIdentifier(idName, "id", context.packageName)
        if (targetId != 0) {
            controllerView.findViewById<View>(targetId)?.visibility = View.GONE
        }
    }
}

private fun formatDuration(value: Double): String {
    val totalSeconds = value.toInt().coerceAtLeast(0)
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60

    return if (hours > 0) {
        String.format(Locale.US, "%d:%02d:%02d", hours, minutes, seconds)
    } else {
        String.format(Locale.US, "%d:%02d", minutes, seconds)
    }
}

private fun formatRate(rate: Float): String {
    return if (rate == rate.toInt().toFloat()) {
        "${rate.toInt()}x"
    } else {
        String.format(Locale.US, "%.2f", rate).trimEnd('0').trimEnd('.') + "x"
    }
}

private fun Color.luminance(): Float {
    return 0.299f * red + 0.587f * green + 0.114f * blue
}
