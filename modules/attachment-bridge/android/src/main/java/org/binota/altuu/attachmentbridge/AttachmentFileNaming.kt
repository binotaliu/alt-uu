package org.binota.altuu.attachmentbridge

import android.webkit.MimeTypeMap
import okhttp3.HttpUrl
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.Charset
import java.nio.charset.CodingErrorAction

/**
 * File name and MIME type resolution for downloaded attachments.
 * Mirrors `AttachmentFileNaming.swift`; keep both in sync.
 */
internal object AttachmentFileNaming {
  const val FALLBACK_BASE_NAME = "download"
  const val FALLBACK_MIME_TYPE = "application/octet-stream"

  /** File systems cap names at 255 UTF-8 bytes; leave room for a `.part` suffix. */
  private const val MAX_FILE_NAME_BYTES = 200

  /** Content types that say nothing about the file; the extension decides instead. */
  private val genericMimeTypes = setOf(
    "application/octet-stream",
    "binary/octet-stream",
    "application/force-download",
    "application/x-download",
    "application/download",
    "application/unknown"
  )

  /** URL path names like `download.php` are endpoints, not file names. */
  private val scriptExtensions = setOf("php", "asp", "aspx", "jsp", "cgi", "do", "action", "ashx", "pl")

  private const val FORBIDDEN_CHARACTERS = "/\\:*?\"<>|"

  /** `text/html; charset=utf-8` → `text/html`; null for empty or generic types. */
  fun normalizedMimeType(raw: String?): String? {
    val base = raw?.substringBefore(';')?.trim()?.lowercase().orEmpty()

    if (base.isEmpty() || !base.contains('/') || base in genericMimeTypes) {
      return null
    }

    return base
  }

  /**
   * Order: caller's preferred name → Content-Disposition → final URL path → original URL path → `download`.
   * A name without an extension borrows the server name's extension, else the MIME type's.
   */
  fun resolveFileName(
    preferred: String?,
    contentDisposition: String?,
    responseUrl: HttpUrl?,
    originalUrl: HttpUrl,
    mimeType: String?
  ): String {
    val serverName = contentDisposition?.let(::parseContentDispositionFileName)?.let(::sanitize)
      ?: responseUrl?.let(::fileNameFromUrl)
      ?: fileNameFromUrl(originalUrl)
    val preferredName = preferred?.let { sanitize(percentDecodedIfPossible(it)) }

    var name = preferredName ?: serverName ?: FALLBACK_BASE_NAME

    if (fileExtension(name) == null) {
      val ext = serverName?.let(::fileExtension) ?: mimeType?.let(::preferredExtension)

      if (ext != null) {
        name = "$name.$ext"
      }
    }

    return truncated(name)
  }

  fun mimeTypeForFileName(fileName: String): String {
    val ext = fileExtension(fileName) ?: return FALLBACK_MIME_TYPE

    return MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.lowercase()) ?: FALLBACK_MIME_TYPE
  }

  fun preferredExtension(mimeType: String): String? =
    MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType.lowercase())

  // region Content-Disposition (RFC 6266 / RFC 5987)

  fun parseContentDispositionFileName(header: String): String? {
    var plain: String? = null
    var extended: String? = null

    for (parameter in splitParameters(header)) {
      val equalsIndex = parameter.indexOf('=')

      if (equalsIndex < 0) {
        continue
      }

      val key = parameter.substring(0, equalsIndex).trim().lowercase()
      val value = parameter.substring(equalsIndex + 1).trim()

      when (key) {
        "filename*" -> extended = decodeExtendedValue(value)
        "filename" -> plain = decodePlainValue(value)
      }
    }

    return extended?.takeIf { it.isNotEmpty() } ?: plain?.takeIf { it.isNotEmpty() }
  }

  /** Splits on `;` outside double quotes. */
  private fun splitParameters(header: String): List<String> {
    val parts = mutableListOf<String>()
    val current = StringBuilder()
    var inQuotes = false
    var escaped = false

    for (character in header) {
      when {
        escaped -> {
          current.append(character)
          escaped = false
        }
        character == '\\' && inQuotes -> {
          current.append(character)
          escaped = true
        }
        character == '"' -> {
          current.append(character)
          inQuotes = !inQuotes
        }
        character == ';' && !inQuotes -> {
          parts.add(current.toString())
          current.setLength(0)
        }
        else -> current.append(character)
      }
    }

    parts.add(current.toString())

    return parts
  }

  private fun unquote(value: String): String {
    if (value.length < 2 || !value.startsWith('"') || !value.endsWith('"')) {
      return value
    }

    val result = StringBuilder()
    var escaped = false

    for (character in value.substring(1, value.length - 1)) {
      when {
        escaped -> {
          result.append(character)
          escaped = false
        }
        character == '\\' -> escaped = true
        else -> result.append(character)
      }
    }

    return result.toString()
  }

  /** `UTF-8''%E8%AC%9B%E7%BE%A9.pdf` → `講義.pdf`. */
  private fun decodeExtendedValue(rawValue: String): String? {
    val value = unquote(rawValue)
    val parts = value.split("'", limit = 3)
    val charset: String
    val encoded: String

    if (parts.size == 3) {
      charset = parts[0].lowercase()
      encoded = parts[2]
    } else {
      charset = "utf-8"
      encoded = value
    }

    val bytes = percentDecodedBytes(encoded) ?: return null

    if (charset == "iso-8859-1" || charset == "latin1") {
      return String(bytes, Charsets.ISO_8859_1)
    }

    return decodeStrict(bytes, Charsets.UTF_8) ?: String(bytes, Charsets.ISO_8859_1)
  }

  private fun decodePlainValue(rawValue: String): String =
    percentDecodedIfPossible(repairLatin1Mojibake(unquote(rawValue)))

  private fun percentDecodedBytes(value: String): ByteArray? {
    val output = ByteArrayOutputStream()
    var index = 0

    while (index < value.length) {
      val character = value[index]

      if (character == '%') {
        if (index + 3 > value.length) {
          return null
        }

        val hex = value.substring(index + 1, index + 3)

        if (!hex.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) {
          return null
        }

        output.write(hex.toInt(16))
        index += 3
      } else {
        val codePoint = value.codePointAt(index)
        output.write(String(Character.toChars(codePoint)).toByteArray(Charsets.UTF_8))
        index += Character.charCount(codePoint)
      }
    }

    return output.toByteArray()
  }

  /** Raw UTF-8 bytes in a header are sometimes surfaced as Latin-1 characters; recover them. */
  private fun repairLatin1Mojibake(value: String): String {
    if (value.any { it.code > 0xFF } || value.none { it.code >= 0x80 }) {
      return value
    }

    return decodeStrict(value.toByteArray(Charsets.ISO_8859_1), Charsets.UTF_8) ?: value
  }

  /** Like Foundation's `removingPercentEncoding`: unchanged when malformed or not UTF-8. */
  fun percentDecodedIfPossible(value: String): String {
    if (!value.contains('%')) {
      return value
    }

    val bytes = percentDecodedBytes(value) ?: return value

    return decodeStrict(bytes, Charsets.UTF_8) ?: value
  }

  private fun decodeStrict(bytes: ByteArray, charset: Charset): String? = try {
    charset.newDecoder()
      .onMalformedInput(CodingErrorAction.REPORT)
      .onUnmappableCharacter(CodingErrorAction.REPORT)
      .decode(ByteBuffer.wrap(bytes))
      .toString()
  } catch (_: CharacterCodingException) {
    null
  }

  // endregion

  // region Helpers

  private fun fileNameFromUrl(url: HttpUrl): String? {
    val lastSegment = url.pathSegments.lastOrNull()?.takeIf { it.isNotEmpty() } ?: return null
    val ext = lastSegment.substringAfterLast('.', "").lowercase()

    if (ext in scriptExtensions) {
      return null
    }

    return sanitize(lastSegment)
  }

  /** Extension used to decide whether a name "has" one: 1–8 ASCII alphanumerics with at least one letter. */
  fun fileExtension(name: String): String? {
    val dotIndex = name.lastIndexOf('.')

    if (dotIndex <= 0 || dotIndex == name.length - 1) {
      return null
    }

    val ext = name.substring(dotIndex + 1)
    val isAsciiAlphanumeric = ext.all { it in 'a'..'z' || it in 'A'..'Z' || it in '0'..'9' }
    val hasLetter = ext.any { it in 'a'..'z' || it in 'A'..'Z' }

    if (ext.length > 8 || !isAsciiAlphanumeric || !hasLetter || ext.lowercase() in scriptExtensions) {
      return null
    }

    return ext
  }

  /** Drops control characters, replaces path/reserved characters with `_`, trims whitespace and leading dots. */
  fun sanitize(value: String): String? {
    val cleaned = StringBuilder()
    var index = 0

    while (index < value.length) {
      val codePoint = value.codePointAt(index)
      index += Character.charCount(codePoint)
      val type = Character.getType(codePoint)

      if (type == Character.CONTROL.toInt() || type == Character.FORMAT.toInt()) {
        continue
      }

      if (codePoint < 0x80 && FORBIDDEN_CHARACTERS.indexOf(codePoint.toChar()) >= 0) {
        cleaned.append('_')
      } else {
        cleaned.appendCodePoint(codePoint)
      }
    }

    val trimmed = cleaned.toString().trim().trimStart('.').trim()

    return trimmed.ifEmpty { null }
  }

  private fun truncated(name: String): String {
    if (name.toByteArray(Charsets.UTF_8).size <= MAX_FILE_NAME_BYTES) {
      return name
    }

    val ext = fileExtension(name) ?: return utf8Prefix(name, MAX_FILE_NAME_BYTES)
    val stem = name.substring(0, name.length - ext.length - 1)

    return "${utf8Prefix(stem, MAX_FILE_NAME_BYTES - ext.length - 1)}.$ext"
  }

  private fun utf8Prefix(value: String, maxBytes: Int): String {
    val result = StringBuilder()
    var used = 0
    var index = 0

    while (index < value.length) {
      val codePoint = value.codePointAt(index)
      val chunk = String(Character.toChars(codePoint))
      val size = chunk.toByteArray(Charsets.UTF_8).size

      if (used + size > maxBytes) {
        break
      }

      result.append(chunk)
      used += size
      index += Character.charCount(codePoint)
    }

    return result.toString()
  }

  // endregion
}
