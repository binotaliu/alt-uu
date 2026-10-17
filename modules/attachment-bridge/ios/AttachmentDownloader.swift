import Foundation

internal struct DownloadedAttachment {
  let fileURL: URL
  let mimeType: String
  let size: Int64
  let fileName: String
}

/// Downloads attachments with an ephemeral URLSession: no shared cookie storage, no cache,
/// an explicit `Cookie` header recomputed on every redirect hop.
internal final class AttachmentDownloader: NSObject, URLSessionDownloadDelegate {
  typealias ProgressHandler = (_ id: String, _ bytesWritten: Int64, _ totalBytes: Int64) -> Void
  typealias Completion = (Result<DownloadedAttachment, AttachmentBridgeException>) -> Void

  private static let maxRedirects = 10
  private static let progressInterval: TimeInterval = 0.1

  private final class TaskState {
    let id: String
    let originalURL: URL
    let preferredFileName: String?
    let explicitCookieHeader: String?
    let completion: Completion
    var jar: DownloadCookieJar
    var result: Result<DownloadedAttachment, AttachmentBridgeException>?
    var cancelled = false
    var redirectCount = 0
    var lastProgressAt: TimeInterval = 0

    init(id: String, originalURL: URL, preferredFileName: String?, explicitCookieHeader: String?, jar: DownloadCookieJar, completion: @escaping Completion) {
      self.id = id
      self.originalURL = originalURL
      self.preferredFileName = preferredFileName
      self.explicitCookieHeader = explicitCookieHeader
      self.jar = jar
      self.completion = completion
    }

    /// Jar cookies for `url`, plus a caller-supplied `Cookie` header when still on the original host.
    func cookieHeader(for url: URL) -> String? {
      var parts: [String] = []

      if let explicitCookieHeader, url.host?.lowercased() == originalURL.host?.lowercased() {
        parts.append(explicitCookieHeader)
      }

      if let jarHeader = jar.headerValue(for: url) {
        parts.append(jarHeader)
      }

      return parts.isEmpty ? nil : parts.joined(separator: "; ")
    }
  }

  private let attachmentsDirectory: URL
  private let onProgress: ProgressHandler
  private let lock = NSLock()
  private var statesByTaskId: [Int: TaskState] = [:]
  private var tasksByDownloadId: [String: URLSessionTask] = [:]
  private var session: URLSession?

  init(attachmentsDirectory: URL, onProgress: @escaping ProgressHandler) {
    self.attachmentsDirectory = attachmentsDirectory
    self.onProgress = onProgress
    super.init()
  }

  private func activeSession() -> URLSession {
    lock.lock()
    defer { lock.unlock() }

    if let session {
      return session
    }

    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieStorage = nil
    configuration.httpShouldSetCookies = false
    configuration.httpCookieAcceptPolicy = .never
    configuration.urlCache = nil
    configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
    configuration.timeoutIntervalForRequest = 60
    configuration.timeoutIntervalForResource = 900

    let queue = OperationQueue()
    queue.name = "org.binota.altuu.attachment-bridge.download"
    queue.maxConcurrentOperationCount = 1

    let created = URLSession(configuration: configuration, delegate: self, delegateQueue: queue)
    session = created

    return created
  }

  func start(_ request: DownloadRequestRecord, completion: @escaping Completion) {
    let rawURL = request.url.trimmingCharacters(in: .whitespacesAndNewlines)

    guard let url = URL(string: rawURL),
          let scheme = url.scheme?.lowercased(),
          scheme == "http" || scheme == "https",
          url.host?.isEmpty == false else {
      completion(.failure(.invalidUrl(rawURL)))
      return
    }

    guard !request.id.isEmpty else {
      completion(.failure(.invalidArgument("缺少下載 id。")))
      return
    }

    var urlRequest = URLRequest(url: url)
    urlRequest.httpMethod = request.method.uppercased() == "POST" ? "POST" : "GET"
    urlRequest.httpShouldHandleCookies = false

    var explicitCookieHeader: String?

    for (name, value) in request.headers {
      if name.caseInsensitiveCompare("Cookie") == .orderedSame {
        explicitCookieHeader = value.isEmpty ? nil : value
      } else {
        urlRequest.setValue(value, forHTTPHeaderField: name)
      }
    }

    if urlRequest.httpMethod == "POST", let body = request.body {
      urlRequest.httpBody = Data(body.utf8)
    }

    let preferredFileName = request.fileName?.trimmingCharacters(in: .whitespacesAndNewlines)
    let state = TaskState(
      id: request.id,
      originalURL: url,
      preferredFileName: preferredFileName?.isEmpty == false ? preferredFileName : nil,
      explicitCookieHeader: explicitCookieHeader,
      jar: DownloadCookieJar(cookies: request.cookies, requestURL: url),
      completion: completion
    )
    urlRequest.setValue(state.cookieHeader(for: url), forHTTPHeaderField: "Cookie")

    let task = activeSession().downloadTask(with: urlRequest)

    lock.lock()
    if tasksByDownloadId[request.id] != nil {
      lock.unlock()
      completion(.failure(.invalidArgument("下載 id 重複：\(request.id)")))
      return
    }
    tasksByDownloadId[request.id] = task
    statesByTaskId[task.taskIdentifier] = state
    lock.unlock()

    task.resume()
  }

  /// Returns false when no download with `id` is in flight.
  func cancel(id: String) -> Bool {
    lock.lock()
    guard let task = tasksByDownloadId[id] else {
      lock.unlock()
      return false
    }
    statesByTaskId[task.taskIdentifier]?.cancelled = true
    lock.unlock()

    task.cancel()

    return true
  }

  func invalidate() {
    lock.lock()
    let current = session
    session = nil
    lock.unlock()

    current?.invalidateAndCancel()
  }

  private func state(for task: URLSessionTask) -> TaskState? {
    lock.lock()
    defer { lock.unlock() }

    return statesByTaskId[task.taskIdentifier]
  }

  private func removeState(for task: URLSessionTask) -> TaskState? {
    lock.lock()
    defer { lock.unlock() }

    guard let state = statesByTaskId.removeValue(forKey: task.taskIdentifier) else {
      return nil
    }

    tasksByDownloadId.removeValue(forKey: state.id)

    return state
  }

  // MARK: - URLSessionTaskDelegate

  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest,
    completionHandler: @escaping @Sendable (URLRequest?) -> Void
  ) {
    guard let state = state(for: task), let nextURL = request.url else {
      completionHandler(request)
      return
    }

    state.redirectCount += 1

    if state.redirectCount > Self.maxRedirects {
      state.result = .failure(.tooManyRedirects)
      completionHandler(nil)
      task.cancel()
      return
    }

    if let currentURL = response.url ?? task.currentRequest?.url {
      state.jar.merge(response: response, url: currentURL)
    }

    var redirected = request
    redirected.httpShouldHandleCookies = false
    redirected.setValue(state.cookieHeader(for: nextURL), forHTTPHeaderField: "Cookie")
    completionHandler(redirected)
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    guard let state = removeState(for: task) else {
      return
    }

    let outcome: Result<DownloadedAttachment, AttachmentBridgeException>

    if case .failure? = state.result, let result = state.result {
      outcome = result
    } else if state.cancelled {
      outcome = .failure(.cancelled)
    } else if let error {
      let nsError = error as NSError

      if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
        outcome = .failure(.cancelled)
      } else {
        outcome = .failure(.downloadFailed(error.localizedDescription))
      }
    } else if let result = state.result {
      outcome = result
    } else {
      outcome = .failure(.downloadFailed(nil))
    }

    if case .failure = outcome, case .success(let attachment)? = state.result {
      try? FileManager.default.removeItem(at: attachment.fileURL.deletingLastPathComponent())
    }

    state.completion(outcome)
  }

  // MARK: - URLSessionDownloadDelegate

  func urlSession(
    _ session: URLSession,
    downloadTask: URLSessionDownloadTask,
    didWriteData bytesWritten: Int64,
    totalBytesWritten: Int64,
    totalBytesExpectedToWrite: Int64
  ) {
    guard let state = state(for: downloadTask) else {
      return
    }

    let now = ProcessInfo.processInfo.systemUptime
    let isComplete = totalBytesExpectedToWrite > 0 && totalBytesWritten >= totalBytesExpectedToWrite

    guard isComplete || now - state.lastProgressAt >= Self.progressInterval else {
      return
    }

    state.lastProgressAt = now
    onProgress(state.id, totalBytesWritten, totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : -1)
  }

  func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
    guard let state = state(for: downloadTask), state.result == nil else {
      return
    }

    guard let response = downloadTask.response as? HTTPURLResponse else {
      state.result = .failure(.downloadFailed(nil))
      return
    }

    guard (200...299).contains(response.statusCode) else {
      state.result = .failure(.httpStatus(response.statusCode))
      return
    }

    do {
      state.result = .success(try persist(location: location, response: response, state: state))
    } catch let error as AttachmentBridgeException {
      state.result = .failure(error)
    } catch {
      state.result = .failure(.downloadFailed(error.localizedDescription))
    }
  }

  /// Moves the temp file to `<cache>/attachments/<id>/<fileName>` (the temp file is deleted when this returns).
  private func persist(location: URL, response: HTTPURLResponse, state: TaskState) throws -> DownloadedAttachment {
    let attributes = try FileManager.default.attributesOfItem(atPath: location.path)
    let size = (attributes[.size] as? NSNumber)?.int64Value ?? 0

    if size == 0 {
      throw AttachmentBridgeException.emptyBody
    }

    let headerMimeType = AttachmentFileNaming.normalizedMimeType(
      response.value(forHTTPHeaderField: "Content-Type") ?? response.mimeType
    )
    let fileName = AttachmentFileNaming.resolveFileName(
      preferred: state.preferredFileName,
      contentDisposition: response.value(forHTTPHeaderField: "Content-Disposition"),
      responseURL: response.url,
      originalURL: state.originalURL,
      mimeType: headerMimeType
    )
    let mimeType = headerMimeType ?? AttachmentFileNaming.mimeType(forFileName: fileName)

    let directory = attachmentsDirectory.appendingPathComponent(Self.directoryName(for: state.id), isDirectory: true)
    try? FileManager.default.removeItem(at: directory)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

    let destination = directory.appendingPathComponent(fileName, isDirectory: false)
    try FileManager.default.moveItem(at: location, to: destination)

    return DownloadedAttachment(fileURL: destination, mimeType: mimeType, size: size, fileName: fileName)
  }

  private static func directoryName(for id: String) -> String {
    let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")
    let scalars = id.unicodeScalars.map { allowed.contains($0) ? Character($0) : "_" }
    let name = String(scalars).trimmingCharacters(in: CharacterSet(charactersIn: "."))

    return name.isEmpty ? UUID().uuidString : name
  }
}
