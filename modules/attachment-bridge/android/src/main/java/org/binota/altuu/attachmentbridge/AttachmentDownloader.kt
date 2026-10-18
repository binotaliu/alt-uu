package org.binota.altuu.attachmentbridge

import android.os.SystemClock
import okhttp3.Call
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

internal data class DownloadedAttachment(
  val file: File,
  val mimeType: String,
  val size: Long,
  val fileName: String
)

/**
 * Downloads attachments with a dedicated OkHttp client: no cookie jar, no cache, manual
 * redirects so the explicit `Cookie` header is recomputed for every hop.
 */
internal class AttachmentDownloader(
  private val attachmentsDirectory: File,
  private val onProgress: (id: String, bytesWritten: Long, totalBytes: Long) -> Unit
) {
  private class ActiveDownload {
    @Volatile var call: Call? = null
    @Volatile var cancelled = false
  }

  private val client: OkHttpClient = OkHttpClient.Builder()
    .cookieJar(CookieJar.NO_COOKIES)
    .followRedirects(false)
    .followSslRedirects(false)
    .connectTimeout(30, TimeUnit.SECONDS)
    .readTimeout(60, TimeUnit.SECONDS)
    .callTimeout(15, TimeUnit.MINUTES)
    .build()

  private val executor: ExecutorService = Executors.newCachedThreadPool()
  private val activeDownloads = ConcurrentHashMap<String, ActiveDownload>()

  fun start(request: DownloadRequestRecord, completion: (Result<DownloadedAttachment>) -> Unit) {
    val rawUrl = request.url.trim()
    val url = rawUrl.toHttpUrlOrNull()
      ?: return completion(Result.failure(AttachmentBridgeException.invalidUrl(rawUrl)))

    if (request.id.isBlank()) {
      return completion(Result.failure(AttachmentBridgeException.invalidArgument("缺少下載 id。")))
    }

    val handle = ActiveDownload()

    if (activeDownloads.putIfAbsent(request.id, handle) != null) {
      return completion(
        Result.failure(AttachmentBridgeException.invalidArgument("下載 id 重複：${request.id}"))
      )
    }

    executor.execute {
      val result = try {
        Result.success(perform(request, url, handle))
      } catch (error: Throwable) {
        File(attachmentsDirectory, directoryName(request.id)).deleteRecursively()
        Result.failure(mapError(error, handle))
      } finally {
        activeDownloads.remove(request.id)
      }

      completion(result)
    }
  }

  /** Returns false when no download with `id` is in flight. */
  fun cancel(id: String): Boolean {
    val handle = activeDownloads[id] ?: return false
    handle.cancelled = true
    handle.call?.cancel()

    return true
  }

  fun shutdown() {
    activeDownloads.keys.toList().forEach { cancel(it) }
    executor.shutdown()
  }

  private fun mapError(error: Throwable, handle: ActiveDownload): AttachmentBridgeException = when {
    handle.cancelled -> AttachmentBridgeException.cancelled()
    error is AttachmentBridgeException -> error
    else -> AttachmentBridgeException.downloadFailed(error.localizedMessage, error)
  }

  private fun perform(request: DownloadRequestRecord, originalUrl: HttpUrl, handle: ActiveDownload): DownloadedAttachment {
    val jar = DownloadCookieJar(request.cookies, originalUrl)
    val explicitCookieHeader = request.headers.entries
      .firstOrNull { it.key.equals("Cookie", ignoreCase = true) }
      ?.value
      ?.takeIf { it.isNotEmpty() }
    var currentUrl = originalUrl
    var method = if (request.method.equals("POST", ignoreCase = true)) "POST" else "GET"
    var redirects = 0

    while (redirects <= MAX_REDIRECTS) {
      val builder = Request.Builder().url(currentUrl)

      request.headers.forEach { (name, value) ->
        if (!name.equals("Cookie", ignoreCase = true)) {
          builder.header(name, value)
        }
      }

      val cookieParts = listOfNotNull(
        explicitCookieHeader?.takeIf { currentUrl.host.equals(originalUrl.host, ignoreCase = true) },
        jar.headerValue(currentUrl)
      )

      if (cookieParts.isNotEmpty()) {
        builder.header("Cookie", cookieParts.joinToString("; "))
      }

      if (method == "POST") {
        builder.post((request.body ?: "").toRequestBody(null))
      } else {
        builder.get()
      }

      val call = client.newCall(builder.build())
      handle.call = call

      if (handle.cancelled) {
        throw AttachmentBridgeException.cancelled()
      }

      val response = call.execute()

      try {
        val location = response.header("Location")

        if (response.isRedirect && location != null) {
          redirects += 1
          jar.merge(currentUrl, response.headers)
          currentUrl = currentUrl.resolve(location)
            ?: throw AttachmentBridgeException.invalidUrl(location)

          val code = response.code

          if (code == 303 || ((code == 301 || code == 302) && method == "POST")) {
            method = "GET"
          }
        } else {
          if (!response.isSuccessful) {
            throw AttachmentBridgeException.httpStatus(response.code)
          }

          return persist(response, request, originalUrl, handle)
        }
      } finally {
        response.close()
      }
    }

    throw AttachmentBridgeException.tooManyRedirects()
  }

  /** Streams the body to `<cache>/attachments/<id>/<fileName>`. */
  private fun persist(
    response: Response,
    request: DownloadRequestRecord,
    originalUrl: HttpUrl,
    handle: ActiveDownload
  ): DownloadedAttachment {
    val body = response.body ?: throw AttachmentBridgeException.emptyBody()
    val headerMimeType = AttachmentFileNaming.normalizedMimeType(response.header("Content-Type"))
    val fileName = AttachmentFileNaming.resolveFileName(
      preferred = request.fileName?.trim()?.takeIf { it.isNotEmpty() },
      contentDisposition = response.header("Content-Disposition"),
      responseUrl = response.request.url,
      originalUrl = originalUrl,
      mimeType = headerMimeType
    )
    val mimeType = headerMimeType ?: AttachmentFileNaming.mimeTypeForFileName(fileName)

    val directory = File(attachmentsDirectory, directoryName(request.id))
    directory.deleteRecursively()

    if (!directory.mkdirs() && !directory.isDirectory) {
      throw AttachmentBridgeException.downloadFailed("無法建立附件暫存目錄。")
    }

    val partialFile = File(directory, "$fileName.part")
    val totalBytes = body.contentLength()
    var bytesWritten = 0L
    var lastProgressAt = 0L
    var lastReportedBytes = -1L

    body.byteStream().use { input ->
      FileOutputStream(partialFile).use { output ->
        val buffer = ByteArray(BUFFER_SIZE)

        while (true) {
          if (handle.cancelled) {
            throw AttachmentBridgeException.cancelled()
          }

          val read = input.read(buffer)

          if (read == -1) {
            break
          }

          output.write(buffer, 0, read)
          bytesWritten += read

          val now = SystemClock.elapsedRealtime()

          if (now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
            lastProgressAt = now
            lastReportedBytes = bytesWritten
            onProgress(request.id, bytesWritten, totalBytes)
          }
        }
      }
    }

    if (bytesWritten != lastReportedBytes) {
      onProgress(request.id, bytesWritten, totalBytes)
    }

    if (bytesWritten == 0L) {
      throw AttachmentBridgeException.emptyBody()
    }

    val destination = File(directory, fileName)

    if (!partialFile.renameTo(destination)) {
      throw AttachmentBridgeException.downloadFailed("無法寫入附件檔案。")
    }

    return DownloadedAttachment(destination, mimeType, bytesWritten, fileName)
  }

  companion object {
    private const val MAX_REDIRECTS = 10
    private const val PROGRESS_INTERVAL_MS = 100L
    private const val BUFFER_SIZE = 64 * 1024

    fun directoryName(id: String): String {
      val name = id.map { if (it.isLetterOrDigit() && it.code < 0x80 || it in "._-") it else '_' }
        .joinToString("")
        .trim('.')

      return name.ifEmpty { "download" }
    }
  }
}
