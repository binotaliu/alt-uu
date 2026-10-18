package org.binota.altuu.attachmentbridge

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.CookieManager
import androidx.core.content.FileProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.text.SimpleDateFormat
import java.util.Collections
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

class AttachmentBridgeModule : Module() {
  private class PendingSave(val source: Uri, val promise: Promise)

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var downloader: AttachmentDownloader? = null
  private var pendingSave: PendingSave? = null
  private val saveExecutor = Executors.newSingleThreadExecutor()

  override fun definition() = ModuleDefinition {
    Name("AltUUAttachmentBridge")

    Events("onDownloadProgress")

    OnDestroy {
      downloader?.shutdown()
      downloader = null
      saveExecutor.shutdown()
    }

    // The process-wide WebView CookieManager. Note: React Native networking (and expo/fetch with
    // credentials) bridges to this same jar via ForwardingCookieHandler.
    AsyncFunction("setWebViewCookies") { url: String, cookies: List<BridgeCookieRecord>, promise: Promise ->
      val target = Uri.parse(url.trim())
      val host = target.host?.lowercase().orEmpty()
      val scheme = target.scheme?.lowercase().orEmpty()

      if (host.isEmpty() || (scheme != "http" && scheme != "https")) {
        throw AttachmentBridgeException.invalidUrl(url)
      }

      cookies.firstOrNull { it.name.isBlank() }?.let { throw AttachmentBridgeException.invalidCookie(it.name) }

      if (cookies.isEmpty()) {
        promise.resolve(null)
        return@AsyncFunction
      }

      val cookieManager = CookieManager.getInstance()
      cookieManager.setAcceptCookie(true)

      val remaining = AtomicInteger(cookies.size)
      val rejected = Collections.synchronizedList(mutableListOf<String>())

      cookies.forEach { cookie ->
        cookieManager.setCookie(cookieUrl(cookie, url.trim(), scheme, host), setCookieHeader(cookie)) { accepted ->
          if (!accepted) {
            rejected.add(cookie.name)
          }

          if (remaining.decrementAndGet() == 0) {
            cookieManager.flush()

            if (rejected.isEmpty()) {
              promise.resolve(null)
            } else {
              promise.reject(AttachmentBridgeException.invalidCookie(rejected.joinToString(", ")))
            }
          }
        }
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("clearWebViewCookies") { promise: Promise ->
      val cookieManager = CookieManager.getInstance()

      cookieManager.removeAllCookies {
        cookieManager.flush()
        promise.resolve(null)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("download") { request: DownloadRequestRecord, promise: Promise ->
      activeDownloader().start(request) { result ->
        result.fold(
          onSuccess = { attachment ->
            promise.resolve(
              mapOf(
                "uri" to Uri.fromFile(attachment.file).toString(),
                "mimeType" to attachment.mimeType,
                "size" to attachment.size.toDouble(),
                "fileName" to attachment.fileName
              )
            )
          },
          onFailure = { error ->
            promise.reject(
              error as? AttachmentBridgeException
                ?: AttachmentBridgeException.downloadFailed(error.localizedMessage, error)
            )
          }
        )
      }
    }

    AsyncFunction("cancelDownload") { id: String ->
      downloader?.cancel(id) ?: false
    }

    AsyncFunction("previewFile") { uri: String, mimeType: String? ->
      val activity = appContext.currentActivity ?: throw AttachmentBridgeException.noPresenter()
      val source = resolveSource(uri)
      val contentUri = toContentUri(source)
      val resolvedMimeType = AttachmentFileNaming.normalizedMimeType(mimeType)
        ?: guessMimeType(source)

      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(contentUri, resolvedMimeType)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }

      try {
        activity.startActivity(intent)
      } catch (error: ActivityNotFoundException) {
        throw AttachmentBridgeException.noViewer(error)
      }
    }.runOnQueue(Queues.MAIN)

    // Read-only. The NativePHP app kept its per-install Laravel APP_KEY in this file; it sits outside
    // the directories expo-file-system can reach.
    AsyncFunction("readLegacyNativePhpAppKey") {
      val file = File(context.dataDir, "app_storage/persisted_data/appkey.txt")

      if (!file.isFile) {
        return@AsyncFunction null
      }

      try {
        file.readText(Charsets.UTF_8).trim().ifEmpty { null }
      } catch (error: java.io.IOException) {
        throw AttachmentBridgeException.legacyReadFailed(error.localizedMessage, error)
      }
    }

    AsyncFunction("fileExists") { path: String ->
      val trimmed = path.trim()
      val parsed = Uri.parse(trimmed)

      val file = when {
        parsed.scheme.equals("file", ignoreCase = true) -> parsed.path?.let(::File)
        trimmed.startsWith("/") -> File(trimmed)
        else -> null
      } ?: throw AttachmentBridgeException.invalidUrl(path)

      file.isFile
    }

    AsyncFunction("saveFile") { uri: String, fileName: String, mimeType: String?, promise: Promise ->
      if (pendingSave != null) {
        throw AttachmentBridgeException.saveInProgress()
      }

      val activity = appContext.currentActivity ?: throw AttachmentBridgeException.noPresenter()
      val source = resolveSource(uri)
      val resolvedMimeType = mimeType?.trim()?.lowercase()?.takeIf { it.contains('/') } ?: guessMimeType(source)
      val suggestedName = AttachmentFileNaming.sanitize(fileName)
        ?: source.lastPathSegment
        ?: AttachmentFileNaming.FALLBACK_BASE_NAME

      val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        setType(resolvedMimeType)
        putExtra(Intent.EXTRA_TITLE, suggestedName)
      }

      pendingSave = PendingSave(source, promise)

      try {
        activity.startActivityForResult(intent, SAVE_REQUEST_CODE)
      } catch (error: ActivityNotFoundException) {
        pendingSave = null
        throw AttachmentBridgeException.saveFailed("找不到可用的檔案儲存位置選擇器。", error)
      }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, payload ->
      if (payload.requestCode != SAVE_REQUEST_CODE) {
        return@OnActivityResult
      }

      val pending = pendingSave ?: return@OnActivityResult
      pendingSave = null
      val destination = payload.data?.data

      if (payload.resultCode != Activity.RESULT_OK || destination == null) {
        pending.promise.resolve(mapOf("saved" to false))
        return@OnActivityResult
      }

      saveExecutor.execute {
        try {
          copy(pending.source, destination)
          pending.promise.resolve(mapOf("saved" to true))
        } catch (error: Exception) {
          // Drop the half-written document so the user does not keep a truncated copy.
          runCatching { android.provider.DocumentsContract.deleteDocument(context.contentResolver, destination) }
          pending.promise.reject(
            error as? AttachmentBridgeException
              ?: AttachmentBridgeException.saveFailed(error.localizedMessage, error)
          )
        }
      }
    }

    OnActivityDestroys {
      // The picker result can no longer reach us; do not leave the promise (and later saves) hanging.
      pendingSave?.promise?.resolve(mapOf("saved" to false))
      pendingSave = null
    }
  }

  private fun activeDownloader(): AttachmentDownloader {
    downloader?.let { return it }

    val created = AttachmentDownloader(File(context.cacheDir, "attachments")) { id, bytesWritten, totalBytes ->
      sendEvent(
        "onDownloadProgress",
        mapOf(
          "id" to id,
          "bytesWritten" to bytesWritten.toDouble(),
          "totalBytes" to totalBytes.toDouble()
        )
      )
    }
    downloader = created

    return created
  }

  /** `file://` URIs and absolute paths must exist; `content://` URIs pass through. */
  private fun resolveSource(uri: String): Uri {
    val trimmed = uri.trim()
    val parsed = Uri.parse(trimmed)

    val file = when {
      parsed.scheme.equals("content", ignoreCase = true) -> return parsed
      parsed.scheme.equals("file", ignoreCase = true) -> parsed.path?.let(::File)
      trimmed.startsWith("/") -> File(trimmed)
      else -> null
    } ?: throw AttachmentBridgeException.invalidUrl(uri)

    if (!file.isFile) {
      throw AttachmentBridgeException.fileNotFound()
    }

    return Uri.fromFile(file)
  }

  private fun toContentUri(source: Uri): Uri {
    if (!source.scheme.equals("file", ignoreCase = true)) {
      return source
    }

    val file = File(requireNotNull(source.path))

    return try {
      FileProvider.getUriForFile(context, "${context.packageName}.AltUUAttachmentBridgeFileProvider", file)
    } catch (error: IllegalArgumentException) {
      // Outside the cache/files roots declared in altuu_attachment_bridge_paths.xml.
      throw AttachmentBridgeException.invalidUrl(source.toString())
    }
  }

  private fun guessMimeType(source: Uri): String {
    if (source.scheme.equals("content", ignoreCase = true)) {
      context.contentResolver.getType(source)?.let { return it }
    }

    return AttachmentFileNaming.mimeTypeForFileName(source.lastPathSegment.orEmpty())
  }

  private fun copy(source: Uri, destination: Uri) {
    val resolver = context.contentResolver
    val input = resolver.openInputStream(source)
      ?: throw AttachmentBridgeException.saveFailed("無法讀取附件檔案。")

    input.use {
      val output = resolver.openOutputStream(destination, "w")
        ?: throw AttachmentBridgeException.saveFailed("無法開啟儲存位置。")

      output.use { stream -> input.copyTo(stream) }
    }
  }

  /** A cookie whose domain does not cover the target host is set against its own domain. */
  private fun cookieUrl(cookie: BridgeCookieRecord, url: String, scheme: String, host: String): String {
    val domain = cookie.domain?.trim()?.trim('.')?.lowercase()

    if (domain.isNullOrEmpty() || host == domain || host.endsWith(".$domain")) {
      return url
    }

    return "$scheme://$domain/"
  }

  private fun setCookieHeader(cookie: BridgeCookieRecord): String = buildString {
    append("${cookie.name}=${cookie.value}")

    cookie.domain?.trim()?.takeIf { it.isNotEmpty() }?.let { append("; Domain=$it") }
    append("; Path=${cookie.path?.takeIf { it.startsWith("/") } ?: "/"}")

    if (cookie.secure) append("; Secure")
    if (cookie.httpOnly) append("; HttpOnly")

    cookie.expires?.let { append("; Expires=${httpDate(it.toLong())}") }
  }

  private fun httpDate(epochMillis: Long): String =
    SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss 'GMT'", Locale.US)
      .apply { timeZone = TimeZone.getTimeZone("GMT") }
      .format(Date(epochMillis))

  companion object {
    private const val SAVE_REQUEST_CODE = 0x41_55 // "AU"
  }
}
