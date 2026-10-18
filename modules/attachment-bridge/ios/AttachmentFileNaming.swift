import Foundation
import UniformTypeIdentifiers

/// File name and MIME type resolution for downloaded attachments.
/// Mirrors `AttachmentFileNaming.kt`; keep both in sync.
internal enum AttachmentFileNaming {
  static let fallbackBaseName = "download"
  static let fallbackMimeType = "application/octet-stream"
  static let maxFileNameBytes = 200

  /// Content types that say nothing about the file; the extension decides instead.
  private static let genericMimeTypes: Set<String> = [
    "application/octet-stream",
    "binary/octet-stream",
    "application/force-download",
    "application/x-download",
    "application/download",
    "application/unknown",
  ]

  /// URL path names like `download.php` are endpoints, not file names.
  private static let scriptExtensions: Set<String> = [
    "php", "asp", "aspx", "jsp", "cgi", "do", "action", "ashx", "pl",
  ]

  private static let forbiddenCharacters = CharacterSet(charactersIn: "/\\:*?\"<>|")

  /// `text/html; charset=utf-8` → `text/html`; nil for empty or generic types.
  static func normalizedMimeType(_ raw: String?) -> String? {
    guard let raw else {
      return nil
    }

    let base = raw.split(separator: ";", maxSplits: 1, omittingEmptySubsequences: false)
      .first
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() } ?? ""

    guard !base.isEmpty, base.contains("/"), !genericMimeTypes.contains(base) else {
      return nil
    }

    return base
  }

  /// Order: caller's preferred name → Content-Disposition → final URL path → original URL path → `download`.
  /// A name without an extension borrows the server name's extension, else the MIME type's.
  static func resolveFileName(
    preferred: String?,
    contentDisposition: String?,
    responseURL: URL?,
    originalURL: URL,
    mimeType: String?
  ) -> String {
    let serverName = contentDisposition.flatMap(parseContentDispositionFileName).flatMap(sanitize)
      ?? responseURL.flatMap(fileName(fromURL:))
      ?? fileName(fromURL: originalURL)
    let preferredName = preferred.flatMap { sanitize(percentDecodedIfPossible($0)) }

    var name = preferredName ?? serverName ?? fallbackBaseName

    if fileExtension(of: name) == nil,
       let ext = serverName.flatMap(fileExtension(of:)) ?? mimeType.flatMap(preferredExtension(forMimeType:)) {
      name += ".\(ext)"
    }

    return truncated(name)
  }

  static func mimeType(forFileName fileName: String) -> String {
    guard let ext = fileExtension(of: fileName),
          let type = UTType(filenameExtension: ext),
          let mime = type.preferredMIMEType else {
      return fallbackMimeType
    }

    return mime
  }

  static func preferredExtension(forMimeType mimeType: String) -> String? {
    UTType(mimeType: mimeType)?.preferredFilenameExtension
  }

  // MARK: - Content-Disposition (RFC 6266 / RFC 5987)

  static func parseContentDispositionFileName(_ header: String) -> String? {
    var plain: String?
    var extended: String?

    for parameter in splitParameters(header) {
      guard let equalsIndex = parameter.firstIndex(of: "=") else {
        continue
      }

      let key = parameter[..<equalsIndex].trimmingCharacters(in: .whitespaces).lowercased()
      let value = parameter[parameter.index(after: equalsIndex)...].trimmingCharacters(in: .whitespaces)

      if key == "filename*" {
        extended = decodeExtendedValue(value)
      } else if key == "filename" {
        plain = decodePlainValue(value)
      }
    }

    if let extended, !extended.isEmpty {
      return extended
    }

    if let plain, !plain.isEmpty {
      return plain
    }

    return nil
  }

  /// Splits on `;` outside double quotes.
  private static func splitParameters(_ header: String) -> [String] {
    var parts: [String] = []
    var current = ""
    var inQuotes = false
    var escaped = false

    for character in header {
      if escaped {
        current.append(character)
        escaped = false
      } else if character == "\\" && inQuotes {
        current.append(character)
        escaped = true
      } else if character == "\"" {
        current.append(character)
        inQuotes.toggle()
      } else if character == ";" && !inQuotes {
        parts.append(current)
        current = ""
      } else {
        current.append(character)
      }
    }

    parts.append(current)

    return parts
  }

  private static func unquote(_ value: String) -> String {
    guard value.count >= 2, value.hasPrefix("\""), value.hasSuffix("\"") else {
      return value
    }

    var result = ""
    var escaped = false

    for character in value.dropFirst().dropLast() {
      if escaped {
        result.append(character)
        escaped = false
      } else if character == "\\" {
        escaped = true
      } else {
        result.append(character)
      }
    }

    return result
  }

  /// `UTF-8''%E8%AC%9B%E7%BE%A9.pdf` → `講義.pdf`.
  private static func decodeExtendedValue(_ rawValue: String) -> String? {
    let value = unquote(rawValue)
    let parts = value.split(separator: "'", maxSplits: 2, omittingEmptySubsequences: false)
    let charset: String
    let encoded: Substring

    if parts.count == 3 {
      charset = parts[0].lowercased()
      encoded = parts[2]
    } else {
      charset = "utf-8"
      encoded = Substring(value)
    }

    guard let bytes = percentDecodedBytes(encoded) else {
      return nil
    }

    if charset == "iso-8859-1" || charset == "latin1" {
      return String(data: Data(bytes), encoding: .isoLatin1)
    }

    return String(data: Data(bytes), encoding: .utf8) ?? String(data: Data(bytes), encoding: .isoLatin1)
  }

  private static func decodePlainValue(_ rawValue: String) -> String {
    let unquoted = repairLatin1Mojibake(unquote(rawValue))

    return percentDecodedIfPossible(unquoted)
  }

  private static func percentDecodedBytes(_ value: Substring) -> [UInt8]? {
    var bytes: [UInt8] = []
    var index = value.startIndex

    while index < value.endIndex {
      let character = value[index]

      if character == "%" {
        let hexStart = value.index(after: index)
        guard let hexEnd = value.index(hexStart, offsetBy: 2, limitedBy: value.endIndex),
              value[hexStart..<hexEnd].allSatisfy(\.isHexDigit),
              let byte = UInt8(value[hexStart..<hexEnd], radix: 16) else {
          return nil
        }
        bytes.append(byte)
        index = hexEnd
      } else {
        bytes.append(contentsOf: Array(String(character).utf8))
        index = value.index(after: index)
      }
    }

    return bytes
  }

  /// Raw UTF-8 bytes in a header are often surfaced as Latin-1 characters; recover them.
  private static func repairLatin1Mojibake(_ value: String) -> String {
    let scalars = value.unicodeScalars

    guard scalars.allSatisfy({ $0.value <= 0xFF }), scalars.contains(where: { $0.value >= 0x80 }) else {
      return value
    }

    let bytes = scalars.map { UInt8($0.value) }

    return String(data: Data(bytes), encoding: .utf8) ?? value
  }

  static func percentDecodedIfPossible(_ value: String) -> String {
    guard value.contains("%") else {
      return value
    }

    return value.removingPercentEncoding ?? value
  }

  // MARK: - Helpers

  private static func fileName(fromURL url: URL) -> String? {
    let lastComponent = url.lastPathComponent

    guard !lastComponent.isEmpty, lastComponent != "/" else {
      return nil
    }

    let ext = (lastComponent as NSString).pathExtension.lowercased()

    if scriptExtensions.contains(ext) {
      return nil
    }

    return sanitize(lastComponent)
  }

  /// Extension used to decide whether a name "has" one: 1–8 ASCII alphanumerics with at least one letter.
  static func fileExtension(of name: String) -> String? {
    let ext = (name as NSString).pathExtension

    guard !ext.isEmpty, ext.count <= 8, ext.count < name.count - 1 else {
      return nil
    }

    let isAsciiAlphanumeric = ext.unicodeScalars.allSatisfy { $0.isASCII && CharacterSet.alphanumerics.contains($0) }
    let hasLetter = ext.unicodeScalars.contains { $0.isASCII && CharacterSet.letters.contains($0) }

    guard isAsciiAlphanumeric, hasLetter, !scriptExtensions.contains(ext.lowercased()) else {
      return nil
    }

    return ext
  }

  /// Drops control characters, replaces path/reserved characters with `_`, trims whitespace and leading dots.
  static func sanitize(_ value: String) -> String? {
    var cleaned = ""

    for scalar in value.unicodeScalars {
      if CharacterSet.controlCharacters.contains(scalar) {
        continue
      }

      if forbiddenCharacters.contains(scalar) {
        cleaned.append("_")
      } else {
        cleaned.unicodeScalars.append(scalar)
      }
    }

    var trimmed = cleaned.trimmingCharacters(in: .whitespacesAndNewlines)

    while trimmed.hasPrefix(".") {
      trimmed.removeFirst()
    }

    trimmed = trimmed.trimmingCharacters(in: .whitespacesAndNewlines)

    return trimmed.isEmpty ? nil : trimmed
  }

  /// File systems cap names at 255 UTF-8 bytes; CJK titles hit that fast. Keeps the extension.
  private static func truncated(_ name: String) -> String {
    guard name.utf8.count > maxFileNameBytes else {
      return name
    }

    if let ext = fileExtension(of: name) {
      let stem = (name as NSString).deletingPathExtension

      return "\(utf8Prefix(stem, maxBytes: maxFileNameBytes - ext.utf8.count - 1)).\(ext)"
    }

    return utf8Prefix(name, maxBytes: maxFileNameBytes)
  }

  private static func utf8Prefix(_ value: String, maxBytes: Int) -> String {
    var result = ""
    var used = 0

    for character in value {
      let size = String(character).utf8.count

      if used + size > maxBytes {
        break
      }

      result.append(character)
      used += size
    }

    return result
  }
}
