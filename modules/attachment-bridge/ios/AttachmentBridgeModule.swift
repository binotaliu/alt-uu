import ExpoModulesCore
import UIKit
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

    // HLS has no AVAssetImageGenerator support, so frames come from a hidden AVPlayer's video output.
    AsyncFunction("captureVideoFrame") { (url: String, seconds: Double, promise: Promise) in
      guard let videoURL = URL(string: url.trimmingCharacters(in: .whitespacesAndNewlines)),
            videoURL.host?.isEmpty == false else {
        throw AttachmentBridgeException.invalidUrl(url)
      }

      let cacheDirectory = self.appContext?.config.cacheDirectory
        ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      let grabber = VideoFrameGrabber(
        outputDirectory: cacheDirectory.appendingPathComponent("video-frames", isDirectory: true)
      )

      grabber.grab(url: videoURL, seconds: seconds) { result in
        _ = grabber // keeps the grabber alive until it finishes
        switch result {
        case .success(let fileURL):
          let size = UIImage(contentsOfFile: fileURL.path)?.size ?? .zero
          promise.resolve([
            "uri": fileURL.absoluteString,
            "width": Double(size.width),
            "height": Double(size.height),
          ])
        case .failure(let error):
          promise.reject(error)
        }
      }
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

    // iPadOS 26 windowed mode draws window controls inside the app's top-left corner; the system
    // reports how far content must stay clear of them. Zero on iPhone, full screen and before iOS 26.
    AsyncFunction("getCornerInsets") { () -> [String: Double] in
      var insets = UIEdgeInsets.zero

      if #available(iOS 26.0, *) {
        let window = UIApplication.shared.connectedScenes
          .compactMap { $0 as? UIWindowScene }
          .flatMap { $0.windows }
          .first { $0.isKeyWindow }

        insets = window?.edgeInsets(for: .margins(cornerAdaptation: .horizontal)) ?? .zero
      }

      return [
        "top": Double(insets.top),
        "right": Double(insets.right),
        "bottom": Double(insets.bottom),
        "left": Double(insets.left),
      ]
    }.runOnQueue(.main)

    // iPhone Duo: the fold (division) and cameras (occlusion) as regions of the key window. Inactive
    // regions are included so JS can tell "not a foldable" (empty) from "foldable, currently flat".
    AsyncFunction("getReservedRegions") { () -> [[String: Any]] in
      guard #available(iOS 27.1, *) else {
        return []
      }

      let window = UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .flatMap { $0.windows }
        .first { $0.isKeyWindow }

      guard let window else {
        return []
      }

      let kinds: [(name: String, kind: UIView.ReservedRegion.Kind)] = [
        ("division", .division),
        ("occlusion", .occlusion),
      ]

      return kinds.flatMap { entry in
        window.reservedRegions(kind: entry.kind, options: [.includeInactive]).map { region in
          [
            "kind": entry.name,
            "active": region.isActive,
            "frame": [
              "x": Double(region.frame.origin.x),
              "y": Double(region.frame.origin.y),
              "width": Double(region.frame.size.width),
              "height": Double(region.frame.size.height),
            ],
          ] as [String: Any]
        }
      }
    }.runOnQueue(.main)

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
