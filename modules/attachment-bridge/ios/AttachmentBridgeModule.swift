import ExpoModulesCore
import WebKit

public final class AttachmentBridgeModule: Module {
  private var downloader: AttachmentDownloader?
  private let previewPresenter = AttachmentPreviewPresenter()
  private let savePresenter = AttachmentSavePresenter()

  public func definition() -> ModuleDefinition {
    Name("AltUUAttachmentBridge")

    Events("onDownloadProgress")

    OnDestroy {
      self.downloader?.invalidate()
      self.downloader = nil
    }

    // Writes into WKWebsiteDataStore.default() only. react-native-webview 14 uses that store
    // unless `sharedCookiesEnabled`, `incognito` or `cacheEnabled={false}` switch it to a
    // non-persistent store (seeded from HTTPCookieStorage.shared, which `fetch` also uses and
    // which we deliberately leave alone).
    AsyncFunction("setWebViewCookies") { (url: String, cookies: [BridgeCookieRecord], promise: Promise) in
      guard let targetURL = URL(string: url.trimmingCharacters(in: .whitespacesAndNewlines)),
            targetURL.host?.isEmpty == false else {
        throw AttachmentBridgeException.invalidUrl(url)
      }

      let httpCookies = try cookies.map { cookie -> HTTPCookie in
        guard let httpCookie = Self.makeHTTPCookie(cookie, for: targetURL) else {
          throw AttachmentBridgeException.invalidCookie(cookie.name)
        }
        return httpCookie
      }

      let cookieStore = WKWebsiteDataStore.default().httpCookieStore
      let group = DispatchGroup()

      for httpCookie in httpCookies {
        group.enter()
        cookieStore.setCookie(httpCookie) {
          group.leave()
        }
      }

      group.notify(queue: .main) {
        promise.resolve(nil)
      }
    }.runOnQueue(.main)

    AsyncFunction("clearWebViewCookies") { (promise: Promise) in
      WKWebsiteDataStore.default().removeData(
        ofTypes: [WKWebsiteDataTypeCookies],
        modifiedSince: Date.distantPast
      ) {
        promise.resolve(nil)
      }
    }.runOnQueue(.main)

    AsyncFunction("download") { (request: DownloadRequestRecord, promise: Promise) in
      self.activeDownloader().start(request) { result in
        switch result {
        case .success(let attachment):
          promise.resolve([
            "uri": attachment.fileURL.absoluteString,
            "mimeType": attachment.mimeType,
            "size": Double(attachment.size),
            "fileName": attachment.fileName,
          ])
        case .failure(let error):
          promise.reject(error)
        }
      }
    }

    AsyncFunction("cancelDownload") { (id: String) -> Bool in
      self.downloader?.cancel(id: id) ?? false
    }

    AsyncFunction("previewFile") { (uri: String, mimeType: String?) in
      let fileURL = try resolveLocalFileURL(uri)

      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        throw AttachmentBridgeException.noPresenter
      }

      try self.previewPresenter.present(fileURL: fileURL, mimeType: mimeType, from: presenter)
    }.runOnQueue(.main)

    // Read-only. The NativePHP app stored its per-install Laravel APP_KEY as a generic password
    // (service = bundle id, account "APP_KEY", no kSecAttrGeneric, so expo-secure-store cannot see it).
    AsyncFunction("readLegacyNativePhpAppKey") { () -> String? in
      let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: Bundle.main.bundleIdentifier ?? "",
        kSecAttrAccount as String: "APP_KEY",
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne,
      ]
      var result: CFTypeRef?
      let status = SecItemCopyMatching(query as CFDictionary, &result)

      if status == errSecItemNotFound {
        return nil
      }

      guard status == errSecSuccess else {
        throw AttachmentBridgeException.legacyReadFailed("Keychain 狀態碼 \(status)")
      }

      guard let data = result as? Data,
            let value = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
            !value.isEmpty else {
        return nil
      }

      return value
    }

    AsyncFunction("fileExists") { (path: String) -> Bool in
      let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
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

      return FileManager.default.fileExists(atPath: fileURL.path, isDirectory: &isDirectory) && !isDirectory.boolValue
    }

    AsyncFunction("saveFile") { (uri: String, fileName: String, _: String?, promise: Promise) in
      let fileURL = try resolveLocalFileURL(uri)

      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        throw AttachmentBridgeException.noPresenter
      }

      try self.savePresenter.present(fileURL: fileURL, fileName: fileName, from: presenter, promise: promise)
    }.runOnQueue(.main)
  }

  private func activeDownloader() -> AttachmentDownloader {
    if let downloader {
      return downloader
    }

    let cacheDirectory = appContext?.config.cacheDirectory
      ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    let created = AttachmentDownloader(
      attachmentsDirectory: cacheDirectory.appendingPathComponent("attachments", isDirectory: true)
    ) { [weak self] id, bytesWritten, totalBytes in
      self?.sendEvent("onDownloadProgress", [
        "id": id,
        "bytesWritten": Double(bytesWritten),
        "totalBytes": Double(totalBytes),
      ])
    }
    downloader = created

    return created
  }

  /// A cookie without `domain` is host-only for `url`; an explicit domain also covers subdomains.
  private static func makeHTTPCookie(_ cookie: BridgeCookieRecord, for url: URL) -> HTTPCookie? {
    guard !cookie.name.isEmpty else {
      return nil
    }

    var properties: [HTTPCookiePropertyKey: Any] = [
      .name: cookie.name,
      .value: cookie.value,
      .path: cookie.path.flatMap { $0.hasPrefix("/") ? $0 : nil } ?? "/",
    ]

    let domain = cookie.domain?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

    if domain.isEmpty {
      properties[.domain] = url.host
      properties[.originURL] = url
    } else {
      properties[.domain] = domain.hasPrefix(".") || isIPAddress(domain) ? domain : ".\(domain)"
    }

    if cookie.secure {
      properties[.secure] = "TRUE"
    }

    if cookie.httpOnly {
      properties[HTTPCookiePropertyKey("HttpOnly")] = "TRUE"
    }

    if let expires = cookie.expires {
      properties[.expires] = Date(timeIntervalSince1970: expires / 1000)
    }

    return HTTPCookie(properties: properties)
  }

  private static func isIPAddress(_ host: String) -> Bool {
    host.contains(":") || host.allSatisfy { $0.isNumber || $0 == "." }
  }
}
