package org.binota.altuu.attachmentbridge

import okhttp3.Cookie
import okhttp3.Headers
import okhttp3.HttpUrl

/**
 * Per-download cookie jar. Nothing is read from or written to `CookieManager`;
 * the `Cookie` header is computed for every hop (initial request and each redirect).
 */
internal class DownloadCookieJar(records: List<BridgeCookieRecord>, requestUrl: HttpUrl) {
  private val cookies = mutableListOf<Cookie>()

  init {
    records.forEach { record -> upsert(toCookie(record, requestUrl)) }
  }

  /** Merges `Set-Cookie` headers of a (redirect) response. */
  fun merge(url: HttpUrl, headers: Headers) {
    Cookie.parseAll(url, headers).forEach(::upsert)
  }

  /** `Cookie` header value for `url`, or null when no cookie applies. */
  fun headerValue(url: HttpUrl): String? {
    val now = System.currentTimeMillis()

    return cookies
      .filter { it.expiresAt > now && it.matches(url) }
      .sortedByDescending { it.path.length }
      .joinToString("; ") { "${it.name}=${it.value}" }
      .ifEmpty { null }
  }

  private fun upsert(cookie: Cookie) {
    cookies.removeAll {
      it.name == cookie.name && it.domain == cookie.domain && it.path == cookie.path
    }

    if (cookie.expiresAt > System.currentTimeMillis()) {
      cookies.add(cookie)
    }
  }

  private fun toCookie(record: BridgeCookieRecord, requestUrl: HttpUrl): Cookie {
    if (record.name.isBlank()) {
      throw AttachmentBridgeException.invalidCookie(record.name)
    }

    return try {
      Cookie.Builder()
        .name(record.name)
        .value(record.value)
        .apply {
          val domain = record.domain?.trim()?.trim('.')?.lowercase()

          // Without an explicit domain the cookie is host-only for the request URL.
          if (domain.isNullOrEmpty()) hostOnlyDomain(requestUrl.host) else domain(domain)

          path(record.path?.takeIf { it.startsWith("/") } ?: "/")

          if (record.secure) secure()
          if (record.httpOnly) httpOnly()
          record.expires?.let { expiresAt(it.toLong()) }
        }
        .build()
    } catch (error: IllegalArgumentException) {
      throw AttachmentBridgeException.invalidCookie(record.name)
    }
  }
}
