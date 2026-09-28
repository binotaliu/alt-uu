package com.altuu.plugins.media_player

import android.content.ClipData
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.view.PixelCopy
import android.view.SurfaceView
import android.view.TextureView
import androidx.core.content.FileProvider
import androidx.fragment.app.FragmentActivity
import androidx.media3.ui.PlayerView
import com.nativephp.mobile.bridge.BridgeError
import java.io.File
import java.lang.ref.WeakReference
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.random.Random

// region Capture, watermark and share

object MediaFrameCapture {
    const val DISCLAIMER =
        "此截圖僅供個人保存學術使用，請遵循合理使用原則，合法使用教材，遵守智慧財產權。此截圖由 Alt UU 產生。"

    private const val MAX_FRAME_WIDTH = 1920
    private const val CAPTURE_TIMEOUT_SECONDS = 3L

    private var playerViewRef: WeakReference<PlayerView>? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private val copyHandler: Handler by lazy {
        val thread = HandlerThread("altuu-frame-capture").also { it.start() }
        Handler(thread.looper)
    }

    /** Called by the overlay so the capture can reach the live video surface. */
    fun registerPlayerView(playerView: PlayerView) {
        playerViewRef = WeakReference(playerView)
    }

    fun captureAndShare(
        activity: FragmentActivity,
        studentId: String,
        courseName: String?,
        materialName: String?,
    ): Double {
        val seconds = MediaPlayerManager.getCurrentTimeSeconds()

        val frame = grabFrame()
            ?: throw BridgeError.ExecutionFailed("目前沒有可擷取的影片畫面")

        val composed = try {
            compose(frame, studentId, courseName, materialName, seconds)
        } finally {
            frame.recycle()
        }

        val file = try {
            write(activity, composed, materialName, seconds)
        } finally {
            composed.recycle()
        }

        mainHandler.post { share(activity, file) }

        return seconds
    }

    // region Frame grab

    private fun grabFrame(): Bitmap? {
        val result = AtomicReference<Bitmap?>(null)
        val latch = CountDownLatch(1)

        val request = {
            try {
                requestFrame(result, latch)
            } catch (_: Exception) {
                latch.countDown()
            }
        }

        if (Looper.myLooper() == Looper.getMainLooper()) {
            request()
        } else {
            mainHandler.post { request() }
        }

        latch.await(CAPTURE_TIMEOUT_SECONDS, TimeUnit.SECONDS)

        return result.get()
    }

    private fun requestFrame(result: AtomicReference<Bitmap?>, latch: CountDownLatch) {
        val playerView = playerViewRef?.get()
        val surface = playerView?.videoSurfaceView
        val player = MediaPlayerManager.getPlayer()

        if (playerView == null || surface == null || player == null || surface.width <= 0 || surface.height <= 0) {
            latch.countDown()
            return
        }

        val videoWidth = player.videoSize.width.takeIf { it > 0 } ?: surface.width
        val width = min(videoWidth, MAX_FRAME_WIDTH)
        val height = max(1, (width * surface.height.toFloat() / surface.width).roundToInt())

        when (surface) {
            is SurfaceView -> {
                val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                PixelCopy.request(surface, bitmap, { code ->
                    if (code == PixelCopy.SUCCESS) {
                        result.set(bitmap)
                    } else {
                        bitmap.recycle()
                    }
                    latch.countDown()
                }, copyHandler)
            }
            is TextureView -> {
                result.set(surface.getBitmap(width, height))
                latch.countDown()
            }
            else -> latch.countDown()
        }
    }

    // endregion

    // region Composition

    fun timestampLabel(seconds: Double): String {
        val total = max(0, seconds.toInt())

        return "%02d:%02d:%02d".format(total / 3600, (total % 3600) / 60, total % 60)
    }

    private fun layout(text: String, paint: TextPaint, width: Int): StaticLayout {
        return StaticLayout.Builder.obtain(text, 0, text.length, paint, width)
            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
            .build()
    }

    private fun compose(
        frame: Bitmap,
        studentId: String,
        courseName: String?,
        materialName: String?,
        seconds: Double,
    ): Bitmap {
        val width = frame.width
        val height = frame.height

        val footerFontSize = max(14f, width / 55f)
        val padding = (footerFontSize * 0.8f).roundToInt()
        val textWidth = width - padding * 2

        val title = listOfNotNull(courseName, materialName).filter { it.isNotEmpty() }.joinToString(" · ")
        val timestamp = timestampLabel(seconds)
        val infoLine = if (title.isEmpty()) timestamp else "$title  $timestamp"

        val infoPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = footerFontSize
            isFakeBoldText = true
        }
        val disclaimerPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(191, 255, 255, 255)
            textSize = footerFontSize * 0.8f
        }

        val infoLayout = layout(infoLine, infoPaint, textWidth)
        val disclaimerLayout = layout(DISCLAIMER, disclaimerPaint, textWidth)
        val gap = (padding * 0.4f).roundToInt()
        val footerHeight = padding * 2 + infoLayout.height + gap + disclaimerLayout.height

        val output = Bitmap.createBitmap(width, height + footerHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)

        canvas.drawBitmap(frame, 0f, 0f, null)
        drawWatermarks(canvas, studentId, width, height)

        canvas.drawRect(
            0f,
            height.toFloat(),
            width.toFloat(),
            (height + footerHeight).toFloat(),
            Paint().apply { color = Color.rgb(20, 20, 20) },
        )

        canvas.save()
        canvas.translate(padding.toFloat(), (height + padding).toFloat())
        infoLayout.draw(canvas)
        canvas.translate(0f, (infoLayout.height + gap).toFloat())
        disclaimerLayout.draw(canvas)
        canvas.restore()

        return output
    }

    /**
     * Draws the student ID at a handful of random positions and angles so it can't be
     * removed by a single crop.
     */
    private fun drawWatermarks(canvas: Canvas, studentId: String, width: Int, height: Int) {
        val fontSize = max(11f, width / 60f)

        val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(56, 255, 255, 255)
            textSize = fontSize
            isFakeBoldText = true
            textAlign = Paint.Align.CENTER
            setShadowLayer(fontSize * 0.08f, 0f, fontSize * 0.04f, Color.argb(89, 0, 0, 0))
        }

        val textWidth = paint.measureText(studentId)
        val metrics = paint.fontMetrics
        val baselineOffset = -(metrics.ascent + metrics.descent) / 2f
        val count = Random.nextInt(4, 7)
        val bandHeight = height.toFloat() / count
        val halfWidth = textWidth / 2f

        for (index in 0 until count) {
            // One watermark per horizontal band keeps them spread out while the
            // exact position and angle within each band stay random.
            val centerX = if (width > textWidth) {
                Random.nextFloat() * (width - textWidth) + halfWidth
            } else {
                width / 2f
            }
            val centerY = bandHeight * (index + 0.2f + Random.nextFloat() * 0.6f)
            val angle = (Random.nextFloat() - 0.5f) * 57f

            canvas.save()
            canvas.rotate(angle, centerX, centerY)
            canvas.drawText(studentId, centerX, centerY + baselineOffset, paint)
            canvas.restore()
        }
    }

    // endregion

    // region Output

    private fun write(activity: FragmentActivity, bitmap: Bitmap, materialName: String?, seconds: Double): File {
        val directory = File(activity.cacheDir, "altuu_captures")
        directory.deleteRecursively()

        if (!directory.mkdirs()) {
            throw BridgeError.ExecutionFailed("無法儲存截圖")
        }

        val safeName = (materialName ?: "")
            .replace(Regex("""[/\\:?%*|"<>\s]+"""), "_")
            .trim('_')
            .take(40)
        val prefix = safeName.ifEmpty { "AltUU" }
        val stamp = timestampLabel(seconds).replace(":", "-")
        val file = File(directory, "${prefix}_$stamp.jpg")

        file.outputStream().use { stream ->
            if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 90, stream)) {
                throw BridgeError.ExecutionFailed("無法產生截圖")
            }
        }

        return file
    }

    private fun share(activity: FragmentActivity, file: File) {
        if (activity.isFinishing || activity.isDestroyed) {
            return
        }

        try {
            val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
            val send = Intent(Intent.ACTION_SEND).apply {
                type = "image/jpeg"
                putExtra(Intent.EXTRA_STREAM, uri)
                clipData = ClipData.newRawUri("", uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            activity.startActivity(Intent.createChooser(send, null))
        } catch (error: Exception) {
            android.util.Log.e("MediaPlayer", "Failed to share capture: ${error.message}")
        }
    }

    // endregion
}

// endregion
