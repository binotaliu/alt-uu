import Foundation

/// Per-download cookie jar. Nothing is read from or written to `HTTPCookieStorage`;
/// the `Cookie` header is computed for every hop (initial request and each redirect).
internal struct DownloadCookieJar {
  struct Entry {
    let name: String
    let value: String
    /// Lowercased, without leading dot.
    let domain: String
    let hostOnly: Bool
    let path: String
    let secure: Bool
    let expiresAt: Date?

    func matches(_ url: URL, now: Date) -> Bool {
      guard let host = url.host?.lowercased() else {
        return false
      }

      if let expiresAt, expiresAt <= now {
        return false
      }

      if secure && url.scheme?.lowercased() != "https" {
        return false
      }

      let domainMatches = hostOnly
        ? host == domain
        : host == domain || host.hasSuffix(".\(domain)")

      guard domainMatches else {
        return false
      }

      let requestPath = url.path.isEmpty ? "/" : url.path

      return Self.pathMatches(requestPath: requestPath, cookiePath: path)
    }

    private static func pathMatches(requestPath: String, cookiePath: String) -> Bool {
      if requestPath == cookiePath {
        return true
      }

      guard requestPath.hasPrefix(cookiePath) else {
        return false
      }

      return cookiePath.hasSuffix("/") || requestPath.dropFirst(cookiePath.count).hasPrefix("/")
    }
  }

  private(set) var entries: [Entry] = []

  init(cookies: [BridgeCookieRecord], requestURL: URL) {
    let requestHost = requestURL.host?.lowercased() ?? ""

    for cookie in cookies where !cookie.name.isEmpty {
      let explicitDomain = cookie.domain?
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
        .trimmingCharacters(in: CharacterSet(charactersIn: "."))
      let hasDomain = explicitDomain.map { !$0.isEmpty } ?? false

      upsert(Entry(
        name: cookie.name,
        value: cookie.value,
        domain: hasDomain ? explicitDomain! : requestHost,
        hostOnly: !hasDomain,
        path: cookie.path.flatMap { $0.hasPrefix("/") ? $0 : nil } ?? "/",
        secure: cookie.secure,
        expiresAt: cookie.expires.map { Date(timeIntervalSince1970: $0 / 1000) }
      ))
    }
  }

  /// Merges `Set-Cookie` headers of a (redirect) response.
  mutating func merge(response: HTTPURLResponse, url: URL) {
    var fields: [String: String] = [:]

    for (key, value) in response.allHeaderFields {
      if let key = key as? String, let value = value as? String {
        fields[key] = value
      }
    }

    for cookie in HTTPCookie.cookies(withResponseHeaderFields: fields, for: url) {
      let hostOnly = !cookie.domain.hasPrefix(".")

      upsert(Entry(
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: ".")),
        hostOnly: hostOnly,
        path: cookie.path.isEmpty ? "/" : cookie.path,
        secure: cookie.isSecure,
        expiresAt: cookie.expiresDate
      ))
    }
  }

  /// `Cookie` header value for `url`, or nil when no cookie applies.
  func headerValue(for url: URL) -> String? {
    let now = Date()
    let matching = entries
      .filter { $0.matches(url, now: now) }
      .sorted { $0.path.count > $1.path.count }

    if matching.isEmpty {
      return nil
    }

    return matching.map { "\($0.name)=\($0.value)" }.joined(separator: "; ")
  }

  private mutating func upsert(_ entry: Entry) {
    entries.removeAll {
      $0.name == entry.name && $0.domain == entry.domain && $0.path == entry.path
    }

    if let expiresAt = entry.expiresAt, expiresAt <= Date() {
      return
    }

    entries.append(entry)
  }
}
