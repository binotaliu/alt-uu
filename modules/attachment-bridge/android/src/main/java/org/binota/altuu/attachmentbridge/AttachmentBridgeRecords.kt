package org.binota.altuu.attachmentbridge

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/** A cookie as sent from JS (`NativeBridgeCookie`). `expires` is epoch milliseconds. */
class BridgeCookieRecord : Record {
  @Field val name: String = ""
  @Field val value: String = ""
  @Field val domain: String? = null
  @Field val path: String? = null
  @Field val secure: Boolean = false
  @Field val httpOnly: Boolean = false
  @Field val expires: Double? = null
}

/** `NativeDownloadRequest` from JS. */
class DownloadRequestRecord : Record {
  @Field val id: String = ""
  @Field val url: String = ""
  @Field val headers: Map<String, String> = emptyMap()
  @Field val cookies: List<BridgeCookieRecord> = emptyList()
  @Field val fileName: String? = null
  @Field val method: String = "GET"
  @Field val body: String? = null
}

internal class AttachmentBridgeException(
  code: String,
  message: String,
  cause: Throwable? = null
) : CodedException(code, message, cause) {
  companion object {
    fun invalidUrl(url: String) =
      AttachmentBridgeException("ERR_INVALID_URL", "附件網址格式不正確：$url")

    fun invalidArgument(message: String) =
      AttachmentBridgeException("ERR_INVALID_ARGUMENT", message)

    fun invalidCookie(name: String) =
      AttachmentBridgeException("ERR_INVALID_COOKIE", "無效的 Cookie：$name")

    /** The message must end with the status code; the JS wrapper parses it into `httpStatus`. */
    fun httpStatus(status: Int) =
      AttachmentBridgeException("ERR_HTTP_STATUS", "下載失敗，HTTP 狀態碼：$status")

    fun emptyBody() = AttachmentBridgeException("ERR_EMPTY_BODY", "附件內容為空。")

    fun tooManyRedirects() =
      AttachmentBridgeException("ERR_TOO_MANY_REDIRECTS", "附件下載重導次數過多。")

    fun cancelled() = AttachmentBridgeException("ERR_DOWNLOAD_CANCELLED", "下載已取消。")

    fun downloadFailed(reason: String?, cause: Throwable? = null) = AttachmentBridgeException(
      "ERR_DOWNLOAD_FAILED",
      if (reason.isNullOrBlank()) "無法下載附件。" else "無法下載附件：$reason",
      cause
    )

    fun fileNotFound() = AttachmentBridgeException("ERR_FILE_NOT_FOUND", "找不到附件檔案。")

    fun noViewer(cause: Throwable? = null) =
      AttachmentBridgeException("ERR_NO_VIEWER", "沒有可開啟此檔案類型的 App。", cause)

    fun noPresenter() =
      AttachmentBridgeException("ERR_NO_PRESENTER", "無法取得目前的畫面以顯示對話框。")

    fun legacyReadFailed(reason: String?, cause: Throwable? = null) = AttachmentBridgeException(
      "ERR_LEGACY_READ_FAILED",
      if (reason.isNullOrBlank()) "無法讀取舊版 App 資料。" else "無法讀取舊版 App 資料：$reason",
      cause
    )

    fun saveInProgress() =
      AttachmentBridgeException("ERR_SAVE_IN_PROGRESS", "已有儲存對話框開啟中。")

    fun saveFailed(reason: String?, cause: Throwable? = null) = AttachmentBridgeException(
      "ERR_SAVE_FAILED",
      if (reason.isNullOrBlank()) "無法儲存檔案。" else "無法儲存檔案：$reason",
      cause
    )
  }
}
