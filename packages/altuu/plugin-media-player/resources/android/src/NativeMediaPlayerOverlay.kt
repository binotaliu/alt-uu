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
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
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
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
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
import android.graphics.BitmapFactory
import com.nativephp.mobile.ui.MaterialIcon
import com.nativephp.plugins.native_ui.NativeUITheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.delay
import java.util.Locale

private val ThemeColor = Color(0xFFF0804E)
private val ThemeColorDark = Color(0xFFC25733)
private val AudioLightGradient = listOf(Color(0xFFFFF4EC), Color(0xFFFFE2D1))
private val AudioDarkGradient = listOf(Color(0xFF30221C), Color(0xFF1F1814))
private val PlaybackRateOptions = listOf(0.75f, 1.0f, 1.25f, 1.5f, 2.0f)

/**
 * Colours of one player. The element (`useNativeTheme`) reads the mobile-ui theme tokens
 * pushed by `NativeAccent::apply` (`accent` / `on-accent` / `surface`), so an accent
 * change re-themes it without a bridge call. Without `useNativeTheme` the fixed warm
 * palette applies.
 */
private data class PlayerColors(
    val theme: Color,
    val onTheme: Color,
    val gradient: List<Color>,
    val subtle: Color,
)

@Composable
private fun rememberPlayerColors(appearance: String?, useNativeTheme: Boolean): PlayerColors {
    val systemDark = isSystemInDarkTheme()
    val isDark = when (appearance?.lowercase(Locale.US)) {
        "dark" -> true
        "light" -> false
        else -> if (useNativeTheme) systemDark else MaterialTheme.colorScheme.surface.luminance() < 0.5f
    }

    if (useNativeTheme) {
        val tokens = if (isDark) NativeUITheme.dark else NativeUITheme.light

        return PlayerColors(
            theme = tokens.accent,
            onTheme = tokens.onAccent,
            gradient = listOf(tokens.surface, tokens.surfaceVariant),
            subtle = tokens.onSurfaceVariant,
        )
    }

    return PlayerColors(
        theme = if (isDark) ThemeColorDark else ThemeColor,
        onTheme = Color.White,
        gradient = if (isDark) AudioDarkGradient else AudioLightGradient,
        subtle = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
fun NativeMediaPlayerOverlay(
    data: MediaPlayerData,
    modifier: Modifier = Modifier,
    isInPiP: Boolean = false,
    useNativeTheme: Boolean = false,
) {
    val colors = rememberPlayerColors(data.appearance, useNativeTheme)
    val playerRevision = MediaPlayerManager.playerRevision
    var hasStarted by remember(data.url, data.type) { mutableStateOf(false) }
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
            if (isPlaying || currentTime > 0.1f) {
                hasStarted = true
            }
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
            colors = colors,
            modifier = modifier,
        )
    } else {
        VideoOverlayContent(
            data = data,
            isPlaying = isPlaying,
            playbackSpeed = playbackSpeed,
            isInPiP = isInPiP,
            colors = colors,
            playerRevision = playerRevision,
            hasStarted = hasStarted,
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
    colors: PlayerColors,
    modifier: Modifier,
) {
    val themeColor = colors.theme
    val gradient = colors.gradient
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
                            color = colors.subtle,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }

                    PlaybackRateMenuButton(
                        playbackSpeed = playbackSpeed,
                        themeColor = themeColor,
                        onThemeColor = colors.onTheme,
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    SkipButton(iconName = "replay_10", contentDescription = "倒轉 10 秒", themeColor = themeColor) {
                        MediaPlayerManager.skipBy(-10.0)
                    }

                    PlayPauseButton(isPlaying = isPlaying, themeColor = themeColor, onThemeColor = colors.onTheme)

                    SkipButton(iconName = "forward_10", contentDescription = "快轉 10 秒", themeColor = themeColor) {
                        MediaPlayerManager.skipBy(10.0)
                    }

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
                                color = colors.subtle,
                            )
                            Text(
                                text = formatDuration(duration.toDouble()),
                                style = MaterialTheme.typography.labelSmall,
                                color = colors.subtle,
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
    colors: PlayerColors,
    playerRevision: Int,
    hasStarted: Boolean,
    modifier: Modifier,
) {
    val context = LocalContext.current
    val themeColor = colors.theme
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
                onThemeColor = colors.onTheme,
                playerRevision = playerRevision,
                hasStarted = hasStarted,
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
        onThemeColor = colors.onTheme,
        playerRevision = playerRevision,
        hasStarted = hasStarted,
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
    onThemeColor: Color,
    playerRevision: Int,
    hasStarted: Boolean,
    modifier: Modifier,
    onToggleFullscreen: () -> Unit,
    onControlsVisibilityChanged: (Boolean) -> Unit,
    onEnterPip: (PlayerView?) -> Unit,
) {
    var isTopOverlayVisible by remember(data.url, data.type, isFullscreen) { mutableStateOf(false) }
    var playerViewRef by remember(data.url, data.type, isFullscreen) { mutableStateOf<PlayerView?>(null) }
    val posterBitmap = rememberPosterBitmap(data.poster)

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
                        MediaFrameCapture.registerPlayerView(this)
                        isTopOverlayVisible = isControllerFullyVisible
                        onControlsVisibilityChanged(isControllerFullyVisible)
                    }
                },
                update = { playerView ->
                    // `playerRevision` changes when the shared player is (re)built, which can
                    // happen after this PlayerView was created (element props arrive async).
                    playerView.tag = playerRevision
                    playerView.player = MediaPlayerManager.getPlayer()
                    playerViewRef = playerView
                    MediaFrameCapture.registerPlayerView(playerView)
                    playerView.useController = !isInPiP
                    playerView.hideSettingsButton()
                    isTopOverlayVisible = !isInPiP && playerView.isControllerFullyVisible
                    onControlsVisibilityChanged(isTopOverlayVisible)
                },
                modifier = Modifier.fillMaxSize(),
            )

            if (!hasStarted && posterBitmap != null) {
                Image(
                    bitmap = posterBitmap,
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black),
                )
            }

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
                                onThemeColor = onThemeColor,
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
private fun PlayPauseButton(isPlaying: Boolean, themeColor: Color, onThemeColor: Color) {
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
            tint = onThemeColor,
        )
    }
}

@Composable
private fun SkipButton(iconName: String, contentDescription: String, themeColor: Color, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(30.dp)
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() },
                onClick = onClick,
            ),
        contentAlignment = Alignment.Center,
    ) {
        MaterialIcon(
            name = iconName,
            contentDescription = contentDescription,
            size = 22.dp,
            tint = themeColor,
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
private fun PlaybackRateMenuButton(playbackSpeed: Float, themeColor: Color, onThemeColor: Color, filled: Boolean = true) {
    var isExpanded by remember { mutableStateOf(false) }
    val backgroundColor = if (filled) themeColor else Color.Black.copy(alpha = 0.35f)
    val textColor = if (filled) onThemeColor else Color.White

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

/** Decodes the poster off the main thread; null while loading or when it cannot be fetched. */
@Composable
private fun rememberPosterBitmap(url: String?): ImageBitmap? {
    var bitmap by remember(url) { mutableStateOf<ImageBitmap?>(null) }

    LaunchedEffect(url) {
        bitmap = null

        if (!url.isNullOrBlank()) {
            bitmap = withContext(Dispatchers.IO) {
                runCatching {
                    java.net.URL(url).openStream().use { BitmapFactory.decodeStream(it) }?.asImageBitmap()
                }.getOrNull()
            }
        }
    }

    return bitmap
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
