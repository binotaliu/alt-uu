import ExpoModulesCore

/// A cookie as sent from JS (`NativeBridgeCookie`). `expires` is epoch milliseconds.
internal struct BridgeCookieRecord: Record {
  @Field var name: String = ""
  @Field var value: String = ""
  @Field var domain: String?
  @Field var path: String?
  @Field var secure: Bool = false
  @Field var httpOnly: Bool = false
  @Field var expires: Double?
}

/// `NativeDownloadRequest` from JS.
internal struct DownloadRequestRecord: Record {
  @Field var id: String = ""
  @Field var url: String = ""
  @Field var headers: [String: String] = [:]
  @Field var cookies: [BridgeCookieRecord] = []
  @Field var fileName: String?
  @Field var method: String = "GET"
  @Field var body: String?
}

internal final class AttachmentBridgeException: Exception, @unchecked Sendable {
  init(_ code: String, _ message: String) {
    super.init(name: "AttachmentBridgeException", description: message, code: code)
  }

  static func invalidUrl(_ url: String) -> AttachmentBridgeException {
    AttachmentBridgeException("ERR_INVALID_URL", "附件網址格式不正確：\(url)")
  }

  static func invalidArgument(_ message: String) -> AttachmentBridgeException {
    AttachmentBridgeException("ERR_INVALID_ARGUMENT", message)
  }

  static func invalidCookie(_ name: String) -> AttachmentBridgeException {
    AttachmentBridgeException("ERR_INVALID_COOKIE", "無效的 Cookie：\(name)")
  }

  /// The message must end with the status code; the JS wrapper parses it into `httpStatus`.
  static func httpStatus(_ status: Int) -> AttachmentBridgeException {
    AttachmentBridgeException("ERR_HTTP_STATUS", "下載失敗，HTTP 狀態碼：\(status)")
  }

  static var emptyBody: AttachmentBridgeException { AttachmentBridgeException("ERR_EMPTY_BODY", "附件內容為空。") }
  static var tooManyRedirects: AttachmentBridgeException { AttachmentBridgeException("ERR_TOO_MANY_REDIRECTS", "附件下載重導次數過多。") }
  static var cancelled: AttachmentBridgeException { AttachmentBridgeException("ERR_DOWNLOAD_CANCELLED", "下載已取消。") }

  static func downloadFailed(_ reason: String?) -> AttachmentBridgeException {
    AttachmentBridgeException("ERR_DOWNLOAD_FAILED", reason.map { "無法下載附件：\($0)" } ?? "無法下載附件。")
  }

  static func frameCaptureFailed(_ reason: String?) -> AttachmentBridgeException {
    AttachmentBridgeException("ERR_FRAME_CAPTURE_FAILED", reason.map { "無法擷取影片畫面：\($0)" } ?? "無法擷取影片畫面。")
  }

  static var fileNotFound: AttachmentBridgeException { AttachmentBridgeException("ERR_FILE_NOT_FOUND", "找不到附件檔案。") }
  static var noViewer: AttachmentBridgeException { AttachmentBridgeException("ERR_NO_VIEWER", "沒有可開啟此檔案類型的檢視器。") }
  static var noPresenter: AttachmentBridgeException { AttachmentBridgeException("ERR_NO_PRESENTER", "無法取得目前的畫面以顯示對話框。") }
  static var saveInProgress: AttachmentBridgeException { AttachmentBridgeException("ERR_SAVE_IN_PROGRESS", "已有儲存對話框開啟中。") }

  static func legacyReadFailed(_ reason: String) -> AttachmentBridgeException {
    AttachmentBridgeException("ERR_LEGACY_READ_FAILED", "無法讀取舊版 App 資料：\(reason)")
  }

  static func saveFailed(_ reason: String) -> AttachmentBridgeException {
    AttachmentBridgeException("ERR_SAVE_FAILED", "無法儲存檔案：\(reason)")
  }
}

/// Resolves `file://` URIs and plain absolute paths to an existing local file URL.
internal func resolveLocalFileURL(_ uri: String) throws -> URL {
  let trimmed = uri.trimmingCharacters(in: .whitespacesAndNewlines)

  if trimmed.isEmpty {
    throw AttachmentBridgeException.fileNotFound
  }

  let fileURL: URL

  if trimmed.hasPrefix("file://") {
    guard let parsed = URL(string: trimmed), parsed.isFileURL else {
      throw AttachmentBridgeException.invalidUrl(trimmed)
    }
    fileURL = parsed
  } else if trimmed.hasPrefix("/") {
    fileURL = URL(fileURLWithPath: trimmed)
  } else {
    throw AttachmentBridgeException.invalidUrl(trimmed)
  }

  var isDirectory: ObjCBool = false
  guard FileManager.default.fileExists(atPath: fileURL.path, isDirectory: &isDirectory), !isDirectory.boolValue else {
    throw AttachmentBridgeException.fileNotFound
  }

  return fileURL
}

/// Creates `<tmp>/<folder>/<uuid>/<fileName>` pointing at `source` (hard link, else copy).
internal func stageFile(_ source: URL, named fileName: String, folder: String) throws -> URL {
  let directory = FileManager.default.temporaryDirectory
    .appendingPathComponent(folder, isDirectory: true)
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

  let destination = directory.appendingPathComponent(fileName)

  do {
    try FileManager.default.linkItem(at: source, to: destination)
  } catch {
    try FileManager.default.copyItem(at: source, to: destination)
  }

  return destination
}
