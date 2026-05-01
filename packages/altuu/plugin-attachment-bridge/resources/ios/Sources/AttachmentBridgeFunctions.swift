import Foundation
import UIKit
import QuickLook
import UniformTypeIdentifiers
import WebKit

enum AttachmentBridgeFunctions {

    class Download: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            guard let rawURL = parameters["url"] as? String else {
                throw NSError(domain: "AttachmentBridge", code: 422, userInfo: [NSLocalizedDescriptionKey: "Missing url parameter"])
            }

            let filename = parameters["filename"] as? String

            AttachmentBridgeCoordinator.shared.start(urlString: rawURL, preferredFilename: filename)

            return BridgeResponse.success(data: [
                "queued": true,
                "platform": "ios"
            ])
        }
    }

    class OpenURL: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            guard let rawURL = parameters["url"] as? String else {
                throw NSError(domain: "AttachmentBridge", code: 422, userInfo: [NSLocalizedDescriptionKey: "Missing url parameter"])
            }

            let cookiesPayload = parameters["cookies"] as? [[String: Any]] ?? []
            let cookies = cookiesPayload.compactMap { item -> HTTPCookie? in
                guard let name = item["name"] as? String,
                      let value = item["value"] as? String,
                      let domain = item["domain"] as? String,
                      !name.isEmpty,
                      !domain.isEmpty else {
                    return nil
                }

                return HTTPCookie(properties: [
                    .name: name,
                    .value: value,
                    .domain: domain,
                    .path: "/",
                ])
            }

            let method = (parameters["method"] as? String ?? "GET").uppercased()
            var postForm: [String: String]? = nil

            if method == "POST" {
                if let rawPostForm = parameters["postForm"] as? [String: Any] {
                    var converted: [String: String] = [:]

                    for (key, value) in rawPostForm {
                        let stringValue: String

                        if let v = value as? String {
                            stringValue = v
                        } else if let v = value as? CustomStringConvertible {
                            stringValue = v.description
                        } else {
                            continue
                        }

                        converted[key] = stringValue
                    }

                    if !converted.isEmpty {
                        postForm = converted
                    }
                }
            }

            AttachmentBridgeCoordinator.shared.openInBrowser(urlString: rawURL, cookies: cookies, postForm: postForm)

            return BridgeResponse.success(data: [
                "opened": true,
                "platform": "ios"
            ])
        }
    }

    class OpenInBrowser: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            return try OpenURL().execute(parameters: parameters)
        }
    }

    class OpenTronclass: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            guard let rawURL = parameters["url"] as? String, !rawURL.isEmpty else {
                throw NSError(domain: "AttachmentBridge", code: 422, userInfo: [NSLocalizedDescriptionKey: "Missing url parameter"])
            }
            guard let url = URL(string: rawURL) else {
                throw NSError(domain: "AttachmentBridge", code: 422, userInfo: [NSLocalizedDescriptionKey: "Invalid url parameter"])
            }

            DispatchQueue.main.async {
                if UIApplication.shared.canOpenURL(url) {
                    UIApplication.shared.open(url, options: [:], completionHandler: nil)
                } else {
                    // Fallback attempt for custom schemes; direct open may still succeed.
                    UIApplication.shared.open(url, options: [:], completionHandler: nil)
                }
            }

            return BridgeResponse.success(data: [
                "opened": true,
                "platform": "ios"
            ])
        }
    }

    class OpenDiscussAttachment: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            guard let cid = parameters["cid"] as? String, !cid.isEmpty else {
                throw NSError(domain: "AttachmentBridge", code: 422, userInfo: [NSLocalizedDescriptionKey: "Missing cid parameter"])
            }

            guard let bid = parameters["bid"] as? String, !bid.isEmpty else {
                throw NSError(domain: "AttachmentBridge", code: 422, userInfo: [NSLocalizedDescriptionKey: "Missing bid parameter"])
            }

            guard let nid = parameters["nid"] as? String, !nid.isEmpty else {
                throw NSError(domain: "AttachmentBridge", code: 422, userInfo: [NSLocalizedDescriptionKey: "Missing nid parameter"])
            }

            guard let attachmentUrl = parameters["attachmentUrl"] as? String, !attachmentUrl.isEmpty else {
                throw NSError(domain: "AttachmentBridge", code: 422, userInfo: [NSLocalizedDescriptionKey: "Missing attachmentUrl parameter"])
            }

            let cookiesPayload = parameters["cookies"] as? [[String: Any]] ?? []
            let cookies = cookiesPayload.compactMap { item -> HTTPCookie? in
                guard let name = item["name"] as? String,
                      let value = item["value"] as? String,
                      let domain = item["domain"] as? String,
                      !name.isEmpty,
                      !domain.isEmpty else {
                    return nil
                }

                return HTTPCookie(properties: [
                    .name: name,
                    .value: value,
                    .domain: domain,
                    .path: "/",
                ])
            }

            AttachmentBridgeCoordinator.shared.openDiscussAttachment(
                cid: cid,
                bid: bid,
                nid: nid,
                attachmentUrl: attachmentUrl,
                cookies: cookies
            )

            return BridgeResponse.success(data: [
                "opened": true,
                "platform": "ios"
            ])
        }
    }

    class OpenLocalFile: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            guard let rawPath = parameters["path"] as? String, !rawPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                throw NSError(domain: "AttachmentBridge", code: 422, userInfo: [NSLocalizedDescriptionKey: "Missing path parameter"])
            }

            let mimeType = (parameters["mimeType"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)

            AttachmentBridgeCoordinator.shared.openLocalFile(path: rawPath, mimeType: mimeType)

            return BridgeResponse.success(data: [
                "opened": true,
                "platform": "ios"
            ])
        }
    }
}

private final class AttachmentBridgeCoordinator: NSObject, QLPreviewControllerDataSource {
    static let shared = AttachmentBridgeCoordinator()

    private let workerQueue = DispatchQueue(label: "com.nativephp.attachment-bridge", qos: .userInitiated)
    private var previewURL: URL?

    private override init() {
        super.init()
    }

    func start(urlString: String, preferredFilename: String?) {
        DispatchQueue.main.async {
            self.presentConfirmAlert(urlString: urlString, preferredFilename: preferredFilename)
        }
    }

    func openInBrowser(urlString: String, cookies: [HTTPCookie], postForm: [String: String]? = nil) {
        DebugLogger.shared.log("[AttachmentBridge] openInBrowser: url=\(urlString), cookies=\(cookies.count), postForm=\(postForm ?? [:])")

        guard let url = URL(string: urlString) else {
            DispatchQueue.main.async {
                self.presentError(message: "附件網址格式不正確。")
            }
            return
        }

        DispatchQueue.main.async {
            self.presentInAppBrowser(url: url, cookies: cookies, postForm: postForm)
        }
    }

    func openDiscussAttachment(cid: String, bid: String, nid: String, attachmentUrl: String, cookies: [HTTPCookie]) {
        let threadURL = URL(string: "https://uu.nou.edu.tw/forum/m_node_chain.php")

        guard let threadURL else {
            DispatchQueue.main.async {
                self.presentError(message: "討論串頁面網址格式不正確。")
            }
            return
        }

        DebugLogger.shared.log("[AttachmentBridge] openDiscussAttachment: cid=\(cid), bid=\(bid), nid=\(nid), attachment=\(attachmentUrl)")

        DispatchQueue.main.async {
            self.presentInAppBrowser(
                url: threadURL,
                cookies: cookies,
                postForm: [
                    "cid": cid,
                    "bid": bid,
                    "nid": nid,
                ],
                autoClickAttachmentURL: attachmentUrl
            )
        }
    }

    func openLocalFile(path: String, mimeType: String?) {
        let trimmedPath = path.trimmingCharacters(in: .whitespacesAndNewlines)

        if trimmedPath.isEmpty {
            DispatchQueue.main.async {
                self.presentError(message: "找不到附件檔案。")
            }
            return
        }

        let fileURL: URL

        if trimmedPath.hasPrefix("file://"), let parsed = URL(string: trimmedPath) {
            fileURL = parsed
        } else {
            fileURL = URL(fileURLWithPath: trimmedPath)
        }

        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            DispatchQueue.main.async {
                self.presentError(message: "找不到附件檔案。")
            }
            return
        }

        let resolvedMimeType = (mimeType?.isEmpty == false ? mimeType : nil)
            ?? mimeTypeFromPath(fileURL.lastPathComponent)

        DispatchQueue.main.async {
            self.presentActionSheet(fileURL: fileURL, mimeType: resolvedMimeType)
        }
    }

    private func presentConfirmAlert(urlString: String, preferredFilename: String?) {
        guard let topController = topViewController() else {
            return
        }

        let displayName = normalizedFilename(preferredFilename)

        let alert = UIAlertController(
            title: "下載附件",
            message: "是否下載 \(displayName)？",
            preferredStyle: .alert
        )

        alert.addAction(UIAlertAction(title: "取消", style: .cancel))
        alert.addAction(UIAlertAction(title: "下載", style: .default, handler: { _ in
            self.fetchAndPresent(urlString: urlString, preferredFilename: preferredFilename)
        }))

        topController.present(alert, animated: true)
    }

    private func fetchAndPresent(urlString: String, preferredFilename: String?) {
        workerQueue.async {
            self.fetchAttachment(urlString: urlString, preferredFilename: preferredFilename, redirectCount: 0) { result in
                switch result {
                case .success(let attachment):
                    do {
                        let fileURL = try self.writeTempFile(from: attachment)
                        DispatchQueue.main.async {
                            self.presentActionSheet(fileURL: fileURL, mimeType: attachment.mimeType)
                        }
                    } catch {
                        DispatchQueue.main.async {
                            self.presentError(message: "附件下載成功，但暫存檔案寫入失敗。")
                        }
                    }
                case .failure(let error):
                    DispatchQueue.main.async {
                        self.presentError(message: error.localizedDescription)
                    }
                }
            }
        }
    }

    private func presentInAppBrowser(url: URL, cookies: [HTTPCookie], postForm: [String: String]? = nil, autoClickAttachmentURL: String? = nil) {
        guard let topController = topViewController() else {
            return
        }

        let browserVC = AttachmentInAppBrowserViewController(
            url: url,
            cookies: cookies,
            postForm: postForm,
            autoClickAttachmentURL: autoClickAttachmentURL
        )
        let nav = UINavigationController(rootViewController: browserVC)
        nav.modalPresentationStyle = .fullScreen
        topController.present(nav, animated: true)
    }

    private func fetchAttachment(urlString: String, preferredFilename: String?, redirectCount: Int, completion: @escaping (Result<DownloadedAttachment, Error>) -> Void) {
        if redirectCount > 8 {
            completion(.failure(AttachmentBridgeError.tooManyRedirects))
            return
        }

        guard let url = URL(string: urlString), let scheme = url.scheme?.lowercased() else {
            completion(.failure(AttachmentBridgeError.invalidURL))
            return
        }

        if scheme == "php" {
            fetchViaLaravel(urlString: urlString, preferredFilename: preferredFilename, redirectCount: redirectCount, completion: completion)
            return
        }

        if scheme == "http" || scheme == "https" {
            var request = URLRequest(url: url)
            request.httpMethod = "GET"

            URLSession.shared.dataTask(with: request) { data, response, error in
                if let error {
                    completion(.failure(error))
                    return
                }

                guard let data, let httpResponse = response as? HTTPURLResponse else {
                    completion(.failure(AttachmentBridgeError.downloadFailed))
                    return
                }

                let filename = self.filenameFromHeaders(httpResponse.allHeaderFields, fallbackURL: url, preferred: preferredFilename)
                let mimeType = httpResponse.mimeType ?? self.mimeTypeFromPath(filename)

                completion(.success(DownloadedAttachment(data: data, filename: filename, mimeType: mimeType)))
            }.resume()

            return
        }

        completion(.failure(AttachmentBridgeError.unsupportedScheme))
    }

    private func fetchViaLaravel(urlString: String, preferredFilename: String?, redirectCount: Int, completion: @escaping (Result<DownloadedAttachment, Error>) -> Void) {
        guard let parsedURL = URL(string: urlString) else {
            completion(.failure(AttachmentBridgeError.invalidURL))
            return
        }

        let urlComponents = URLComponents(url: parsedURL, resolvingAgainstBaseURL: false)
        let requestPath = parsedURL.path.isEmpty ? "/" : parsedURL.path
        let requestQuery = urlComponents?.query ?? ""

        var headers = cookieHeaders()

        let request = RequestData(
            method: "GET",
            uri: requestPath,
            data: nil,
            query: requestQuery,
            headers: headers
        )

        DebugLogger.shared.log("[AttachmentBridge] fetchViaLaravel request: \(request.method) \(request.uri) ?\(request.query)")
        DebugLogger.shared.log("[AttachmentBridge] fetchViaLaravel headers: \(request.headers)")

        // Route the PHP call through the dedicated PHP serial queue to prevent concurrent
        // php_embed_init / TSRM initialization which causes EXC_BAD_ACCESS crashes when
        // the PHP worker thread is already running (e.g. a scheduled sleep() artisan job).
        PersistentPHPRuntime.shared.executeOnPHPThreadAsync {
            let rawResponse: String
            if PersistentPHPRuntime.shared.isBooted {
                rawResponse = PersistentPHPRuntime.shared.dispatch(request: request)
            } else {
                guard let legacyResponse = NativePHPApp.laravel(request: request) else {
                    DebugLogger.shared.log("[AttachmentBridge] fetchViaLaravel: no response from NativePHPApp.laravel")
                    completion(.failure(AttachmentBridgeError.downloadFailed))
                    return
                }
                rawResponse = legacyResponse
            }

            DebugLogger.shared.log("[AttachmentBridge] fetchViaLaravel: rawResponse length=\(rawResponse.utf8.count)")

            guard let parsedResponse = self.parseLaravelRawResponse(rawResponse) else {
                DebugLogger.shared.log("[AttachmentBridge] fetchViaLaravel: parseLaravelRawResponse failed")
                completion(.failure(AttachmentBridgeError.invalidResponse))
                return
            }

            var responseHeaders = parsedResponse.headers
            let statusCode = parsedResponse.statusCode
            let bodyString = parsedResponse.body

            if (300...399).contains(statusCode), let location = responseHeaders["location"] {
                DebugLogger.shared.log("[AttachmentBridge] fetchViaLaravel: redirect \(statusCode) -> \(location)")
                let nextURL = self.absoluteLocation(from: location, current: urlString)
                self.fetchAttachment(urlString: nextURL, preferredFilename: preferredFilename, redirectCount: redirectCount + 1, completion: completion)
                return
            }

            guard (200...299).contains(statusCode) else {
                completion(.failure(AttachmentBridgeError.downloadFailed))
                return
            }

            let bodyData: Data
            if responseHeaders["x-body-encoding"] == "base64" {
                let trimmed = bodyString.trimmingCharacters(in: .whitespacesAndNewlines)
                bodyData = Data(base64Encoded: trimmed) ?? Data()
            } else {
                if bodyString == "\r\n" || bodyString == "\n" {
                    completion(.failure(AttachmentBridgeError.emptyBody))
                    return
                }

                bodyData = bodyString.data(using: .utf8) ?? Data()
            }

            if bodyData.isEmpty {
                DebugLogger.shared.log("[AttachmentBridge] fetchViaLaravel: bodyData empty (status=\(statusCode), headers=\(responseHeaders))")
                completion(.failure(AttachmentBridgeError.emptyBody))
                return
            }

            let filename = self.filenameFromHeaders(responseHeaders, fallbackURL: URL(string: urlString), preferred: preferredFilename)
            let mimeType = responseHeaders["content-type"] ?? self.mimeTypeFromPath(filename)

            completion(.success(DownloadedAttachment(data: bodyData, filename: filename, mimeType: mimeType)))
        }
    }

    private func absoluteLocation(from location: String, current: String) -> String {
        let trimmed = location.trimmingCharacters(in: .whitespacesAndNewlines)

        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") || trimmed.hasPrefix("php://") {
            return trimmed
        }

        if trimmed.hasPrefix("/") {
            return "php://127.0.0.1\(trimmed)"
        }

        if let currentURL = URL(string: current),
           let base = URL(string: currentURL.deletingLastPathComponent().absoluteString + "/"),
           let resolved = URL(string: trimmed, relativeTo: base)?.absoluteURL.absoluteString {
            return resolved
        }

        return "php://127.0.0.1/"
    }

    private func parseLaravelRawResponse(_ rawResponse: String) -> ParsedLaravelResponse? {
        let separator: String

        if rawResponse.contains("\r\n\r\n") {
            separator = "\r\n\r\n"
        } else if rawResponse.contains("\n\n") {
            separator = "\n\n"
        } else {
            return nil
        }

        let segments = rawResponse.components(separatedBy: separator)

        guard segments.count >= 2 else {
            return nil
        }

        let headerString = segments[0]
        let body = segments.dropFirst().joined(separator: separator)
        let headerLines = headerString.components(separatedBy: .newlines).filter { !$0.isEmpty }

        var statusCode = 200
        if let statusLine = headerLines.first,
           let codeString = statusLine.split(separator: " ").dropFirst().first,
           let code = Int(codeString) {
            statusCode = code
        }

        var parsedHeaders: [String: String] = [:]
        for line in headerLines.dropFirst() {
            guard let colonIndex = line.firstIndex(of: ":") else {
                continue
            }

            let key = line[..<colonIndex].trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let value = line[line.index(after: colonIndex)...].trimmingCharacters(in: .whitespacesAndNewlines)

            if !key.isEmpty {
                parsedHeaders[key] = value
            }
        }

        return ParsedLaravelResponse(statusCode: statusCode, headers: parsedHeaders, body: body)
    }

    private func cookieHeaders() -> [String: String] {
        var headers: [String: String] = [:]
        let semaphore = DispatchSemaphore(value: 0)

        DispatchQueue.main.async {
            WebView.dataStore.httpCookieStore.getAllCookies { cookies in
                let domainCookies = cookies.filter { $0.domain == "127.0.0.1" }
                let cookieHeader = domainCookies.map {
                    "\($0.name)=\($0.value.removingPercentEncoding ?? $0.value)"
                }.joined(separator: "; ")

                if !cookieHeader.isEmpty {
                    headers["Cookie"] = cookieHeader
                }

                if let xsrf = domainCookies.first(where: { $0.name == "XSRF-TOKEN" })?.value.removingPercentEncoding,
                   !xsrf.isEmpty {
                    headers["X-XSRF-TOKEN"] = xsrf
                }

                semaphore.signal()
            }
        }

        _ = semaphore.wait(timeout: .now() + 2)

        return headers
    }

    private func filenameFromHeaders(_ headers: [AnyHashable: Any], fallbackURL: URL?, preferred: String?) -> String {
        if let preferred {
            let normalized = normalizedFilename(preferred)
            if !normalized.isEmpty {
                return normalized
            }
        }

        if let contentDisposition = (headers["content-disposition"] as? String) ?? (headers["Content-Disposition"] as? String),
           let extracted = parseFilename(from: contentDisposition) {
            return extracted
        }

        if let lastPath = fallbackURL?.lastPathComponent.removingPercentEncoding, !lastPath.isEmpty {
            return normalizedFilename(lastPath)
        }

        return "attachment.bin"
    }

    private func parseFilename(from contentDisposition: String) -> String? {
        let parts = contentDisposition.components(separatedBy: ";")

        for part in parts {
            let trimmed = part.trimmingCharacters(in: .whitespacesAndNewlines)

            if trimmed.lowercased().hasPrefix("filename*=") {
                let value = trimmed.dropFirst("filename*=".count)
                let normalized = value.replacingOccurrences(of: "UTF-8''", with: "")
                return normalized.removingPercentEncoding
            }

            if trimmed.lowercased().hasPrefix("filename=") {
                let value = trimmed.dropFirst("filename=".count)
                return String(value).trimmingCharacters(in: CharacterSet(charactersIn: "\""))
            }
        }

        return nil
    }

    private func mimeTypeFromPath(_ filename: String) -> String {
        let lower = filename.lowercased()

        if lower.hasSuffix(".pdf") { return "application/pdf" }
        if lower.hasSuffix(".png") { return "image/png" }
        if lower.hasSuffix(".jpg") || lower.hasSuffix(".jpeg") { return "image/jpeg" }
        if lower.hasSuffix(".gif") { return "image/gif" }
        if lower.hasSuffix(".webp") { return "image/webp" }
        if lower.hasSuffix(".txt") { return "text/plain" }
        if lower.hasSuffix(".csv") { return "text/csv" }

        return "application/octet-stream"
    }

    private func writeTempFile(from attachment: DownloadedAttachment) throws -> URL {
        let baseName = normalizedFilename(attachment.filename)
        let fileExtension = (baseName as NSString).pathExtension

        var finalName = baseName
        if fileExtension.isEmpty,
           let ext = preferredExtension(for: attachment.mimeType),
           !ext.isEmpty {
            finalName += ".\(ext)"
        }

        let targetURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + "-" + finalName)
        try attachment.data.write(to: targetURL, options: .atomic)

        return targetURL
    }

    private func preferredExtension(for mimeType: String) -> String? {
        if let type = UTType(mimeType: mimeType) {
            return type.preferredFilenameExtension
        }

        return nil
    }

    private func presentActionSheet(fileURL: URL, mimeType: String) {
        guard let topController = topViewController() else {
            return
        }

        let alert = UIAlertController(
            title: "附件下載完成",
            message: fileURL.lastPathComponent,
            preferredStyle: .actionSheet
        )

        if canPreview(mimeType: mimeType, fileURL: fileURL) {
            alert.addAction(UIAlertAction(title: "檢視", style: .default, handler: { _ in
                self.previewURL = fileURL
                let previewController = QLPreviewController()
                previewController.dataSource = self
                topController.present(previewController, animated: true)
            }))
        }

        alert.addAction(UIAlertAction(title: "儲存", style: .default, handler: { _ in
            if #available(iOS 14.0, *) {
                let picker = UIDocumentPickerViewController(forExporting: [fileURL])
                topController.present(picker, animated: true)
            } else {
                let activity = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
                topController.present(activity, animated: true)
            }
        }))

        alert.addAction(UIAlertAction(title: "取消", style: .cancel))

        if let popover = alert.popoverPresentationController {
            popover.sourceView = topController.view
            popover.sourceRect = CGRect(x: topController.view.bounds.midX, y: topController.view.bounds.midY, width: 1, height: 1)
            popover.permittedArrowDirections = []
        }

        topController.present(alert, animated: true)
    }

    private func canPreview(mimeType: String, fileURL: URL) -> Bool {
        if mimeType.hasPrefix("image/") || mimeType == "application/pdf" {
            return true
        }

        return QLPreviewController.canPreview(fileURL as NSURL)
    }

    private func presentError(message: String) {
        guard let topController = topViewController() else {
            return
        }

        let alert = UIAlertController(
            title: "下載失敗",
            message: message,
            preferredStyle: .alert
        )

        alert.addAction(UIAlertAction(title: "確定", style: .default))
        topController.present(alert, animated: true)
    }

    private func topViewController(base: UIViewController? = nil) -> UIViewController? {
        let root: UIViewController?

        if let base {
            root = base
        } else {
            root = UIApplication.shared
                .connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first(where: { $0.isKeyWindow })?
                .rootViewController
        }

        if let navigation = root as? UINavigationController {
            return topViewController(base: navigation.visibleViewController)
        }

        if let tab = root as? UITabBarController {
            return topViewController(base: tab.selectedViewController)
        }

        if let presented = root?.presentedViewController {
            return topViewController(base: presented)
        }

        return root
    }

    private func normalizedFilename(_ filename: String?) -> String {
        let fallback = "attachment.bin"

        guard let filename else {
            return fallback
        }

        let decoded = filename.removingPercentEncoding ?? filename
        let trimmed = decoded.trimmingCharacters(in: .whitespacesAndNewlines)

        if trimmed.isEmpty {
            return fallback
        }

        let sanitized = trimmed.replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "\\\\", with: "_")
            .replacingOccurrences(of: ":", with: "_")

        return sanitized.isEmpty ? fallback : sanitized
    }

    func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
        return previewURL == nil ? 0 : 1
    }

    func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
        return (previewURL ?? URL(fileURLWithPath: NSTemporaryDirectory())) as NSURL
    }
}

// MARK: - In-App Browser

private final class AttachmentInAppBrowserViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private var webView: WKWebView!
    private var progressView: UIProgressView!
    private var progressObservation: NSKeyValueObservation?
    private var titleObservation: NSKeyValueObservation?
    private var downloadedFileURL: URL?
    private var autoClickAttempts = 0
    private let targetURL: URL
    private let cookies: [HTTPCookie]
    private let postForm: [String: String]?
    private let autoClickAttachmentURL: String?

    init(url: URL, cookies: [HTTPCookie], postForm: [String: String]? = nil, autoClickAttachmentURL: String? = nil) {
        self.targetURL = url
        self.cookies = cookies
        self.postForm = postForm
        self.autoClickAttachmentURL = autoClickAttachmentURL
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        navigationItem.title = "App 內瀏覽器"
        navigationItem.leftBarButtonItem = UIBarButtonItem(title: "完成", style: .done, target: self, action: #selector(dismissSelf))
        navigationItem.rightBarButtonItem = UIBarButtonItem(barButtonSystemItem: .action, target: self, action: #selector(shareURL))

        setupWebView()
        setupProgressView()
        injectCookiesAndLoad()
    }

    private func setupWebView() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = WKWebsiteDataStore.nonPersistent()

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        titleObservation = webView.observe(\.title, options: .new) { [weak self] _, change in
            if let title = change.newValue ?? nil, !title.isEmpty {
                self?.navigationItem.title = title
            }
        }
    }

    // MARK: - WKUIDelegate for JS alert/confirm/prompt

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "確定", style: .default) { _ in
            completionHandler()
        })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in
            completionHandler(false)
        })
        alert.addAction(UIAlertAction(title: "確定", style: .default) { _ in
            completionHandler(true)
        })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { textField in
            textField.text = defaultText
        }
        alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in
            completionHandler(nil)
        })
        alert.addAction(UIAlertAction(title: "確定", style: .default) { _ in
            completionHandler(alert.textFields?.first?.text)
        })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }

        return nil
    }

    func webViewDidClose(_ webView: WKWebView) {
        dismiss(animated: true)
    }

    private func setupProgressView() {
        progressView = UIProgressView(progressViewStyle: .bar)
        progressView.translatesAutoresizingMaskIntoConstraints = false
        progressView.progressTintColor = .systemBlue
        progressView.trackTintColor = .clear
        view.addSubview(progressView)

        NSLayoutConstraint.activate([
            progressView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            progressView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progressView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progressView.heightAnchor.constraint(equalToConstant: 2),
        ])

        progressObservation = webView.observe(\.estimatedProgress, options: .new) { [weak self] webView, _ in
            guard let self else { return }
            let progress = Float(webView.estimatedProgress)
            self.progressView.setProgress(progress, animated: true)
            self.progressView.isHidden = progress >= 1.0
        }
    }

    private func injectCookiesAndLoad() {
        let cookieStore = webView.configuration.websiteDataStore.httpCookieStore
        let group = DispatchGroup()

        for cookie in cookies {
            group.enter()
            cookieStore.setCookie(cookie) {
                group.leave()
            }
        }

        group.notify(queue: .main) { [weak self] in
            guard let self else { return }
            var request = URLRequest(url: self.targetURL)

            if let postForm = self.postForm {
                request.httpMethod = "POST"
                request.setValue("application/x-www-form-urlencoded; charset=utf-8", forHTTPHeaderField: "Content-Type")
                request.httpBody = self.formBody(from: postForm)
                DebugLogger.shared.log("[AttachmentBridge] InAppBrowser: POST \(self.targetURL.absoluteString) with \(postForm)")
            } else {
                request.httpMethod = "GET"
                DebugLogger.shared.log("[AttachmentBridge] InAppBrowser: GET \(self.targetURL.absoluteString)")
            }

            self.webView.load(request)
        }
    }

    private func formBody(from form: [String: String]) -> Data {
        let body = form
            .sorted(by: { $0.key < $1.key })
            .map { key, value in
                "\(key.urlFormEncoded)=\(value.urlFormEncoded)"
            }
            .joined(separator: "&")

        return Data(body.utf8)
    }

    private func tryAutoClickAttachmentLink() {
        guard let target = autoClickAttachmentURL, !target.isEmpty else {
            return
        }

        autoClickAttempts += 1

        let escapedTarget = target.javaScriptEscaped
        let script = """
        (() => {
          const targetRaw = '\(escapedTarget)';
          const safeDecode = (value) => {
            try {
              return decodeURIComponent(value || '');
            } catch {
              return value || '';
            }
          };
          const target = safeDecode(targetRaw);
          const links = Array.from(document.querySelectorAll('a[href]'));

          const normalize = (value) => safeDecode(String(value || '')).trim();
          const match = links.find((link) => {
            const attrHref = normalize(link.getAttribute('href'));
            const absHref = normalize(link.href);
            const candidates = [attrHref, absHref];

            return candidates.some((candidate) => {
              if (!candidate) {
                return false;
              }

              return candidate === target || candidate.includes(target) || target.includes(candidate);
            });
          });

          if (!match) {
            return JSON.stringify({ clicked: false, reason: 'not-found', totalLinks: links.length });
          }

          match.click();
          return JSON.stringify({ clicked: true, href: match.getAttribute('href') || match.href });
        })();
        """

        webView.evaluateJavaScript(script) { [weak self] result, error in
            guard let self else { return }

            if let error {
                DebugLogger.shared.log("[AttachmentBridge] InAppBrowser auto-click JS error: \(error.localizedDescription)")
                return
            }

            let payload = (result as? String) ?? ""
            DebugLogger.shared.log("[AttachmentBridge] InAppBrowser auto-click attempt #\(self.autoClickAttempts): \(payload)")

            if payload.contains("\"clicked\":true") {
                return
            }

            if self.autoClickAttempts < 5 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
                    self?.tryAutoClickAttachmentLink()
                }
            }
        }
    }

    @objc private func dismissSelf() {
        dismiss(animated: true)
    }

    @objc private func shareURL() {
        let items: [Any] = [targetURL]
        let activity = UIActivityViewController(activityItems: items, applicationActivities: nil)

        if let popover = activity.popoverPresentationController {
            popover.barButtonItem = navigationItem.rightBarButtonItem
        }

        present(activity, animated: true)
    }

    // MARK: WKNavigationDelegate

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if navigationResponse.canShowMIMEType {
            decisionHandler(.allow)
            return
        }

        decisionHandler(.download)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            decisionHandler(.cancel)
            return
        }

        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        DebugLogger.shared.log("[AttachmentBridge] InAppBrowser navigation failed: \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if autoClickAttachmentURL != nil {
            tryAutoClickAttachmentLink()
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        DebugLogger.shared.log("[AttachmentBridge] InAppBrowser provisional navigation failed: \(error.localizedDescription)")

        let alert = UIAlertController(
            title: "載入失敗",
            message: error.localizedDescription,
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "確定", style: .default) { [weak self] _ in
            self?.dismiss(animated: true)
        })
        present(alert, animated: true)
    }

    // MARK: WKDownloadDelegate

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString + "-" + suggestedFilename)
        downloadedFileURL = tempURL
        completionHandler(tempURL)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let fileURL = downloadedFileURL else { return }

        DebugLogger.shared.log("[AttachmentBridge] InAppBrowser download finished: \(fileURL.lastPathComponent)")

        let alert = UIAlertController(
            title: "下載完成",
            message: fileURL.lastPathComponent,
            preferredStyle: .actionSheet
        )

        if QLPreviewController.canPreview(fileURL as NSURL) {
            alert.addAction(UIAlertAction(title: "檢視", style: .default) { [weak self] _ in
                let ql = QLPreviewController()
                ql.dataSource = self
                self?.present(ql, animated: true)
            })
        }

        alert.addAction(UIAlertAction(title: "儲存", style: .default) { [weak self] _ in
            guard let self else { return }
            let picker = UIDocumentPickerViewController(forExporting: [fileURL])
            self.present(picker, animated: true)
        })

        alert.addAction(UIAlertAction(title: "取消", style: .cancel))

        if let popover = alert.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            popover.permittedArrowDirections = []
        }

        present(alert, animated: true)
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        DebugLogger.shared.log("[AttachmentBridge] InAppBrowser download failed: \(error.localizedDescription)")

        let alert = UIAlertController(
            title: "下載失敗",
            message: error.localizedDescription,
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "確定", style: .default))
        present(alert, animated: true)
    }

    deinit {
        progressObservation?.invalidate()
        titleObservation?.invalidate()
    }
}

private extension String {
    var urlFormEncoded: String {
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
        return addingPercentEncoding(withAllowedCharacters: allowed) ?? self
    }

    var javaScriptEscaped: String {
        replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
    }
}

extension AttachmentInAppBrowserViewController: QLPreviewControllerDataSource {
    func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
        return downloadedFileURL == nil ? 0 : 1
    }

    func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
        return (downloadedFileURL ?? URL(fileURLWithPath: NSTemporaryDirectory())) as NSURL
    }
}

private struct DownloadedAttachment {
    let data: Data
    let filename: String
    let mimeType: String
}

private struct ParsedLaravelResponse {
    let statusCode: Int
    let headers: [String: String]
    let body: String
}

private enum AttachmentBridgeError: LocalizedError {
    case invalidURL
    case unsupportedScheme
    case invalidResponse
    case emptyBody
    case tooManyRedirects
    case downloadFailed

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "附件網址格式不正確。"
        case .unsupportedScheme:
            return "不支援的附件網址協定。"
        case .invalidResponse:
            return "原生橋接收到無效回應。"
        case .emptyBody:
            return "附件內容為空。"
        case .tooManyRedirects:
            return "附件下載重導次數過多。"
        case .downloadFailed:
            return "無法下載附件。"
        }
    }
}
