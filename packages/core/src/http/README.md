# HTTP transport: cookies and redirects

Core talks to HUNGU and the school portal with an explicit cookie jar per
account session (a `name → value` map stored in the session, as the legacy
PHP clients did). The native networking stacks under React Native have their
own shared cookie stores and follow redirects by themselves. This note records
why the app uses `expo/fetch` with `credentials: 'omit'`, and why core follows
redirects in JS.

## What the legacy app relied on

- Every call went through Laravel's `Http` client (Guzzle). There was **no
  cookie jar**: the `Cookie` header was built by hand from `session.cookies`,
  and `Set-Cookie` was read from the response and merged back
  (`extractSetCookies` + `mergeCookies`: name/value only, expiry ignored).
- Guzzle followed redirects by default (`allow_redirects`: max 5, `strict =
false`, so 301/302/303 on a POST become a GET). The `Cookie` header was kept
  on same-host hops and dropped when the host changed. `Set-Cookie` on the
  intermediate 3xx responses was **lost**, because only the final response
  was inspected.
- The one flow that needs a redirect response itself is the **school portal
  login** (`SchoolPortalProxyClient::login`). Its POST used `allow_redirects
=> false`, because the authenticated `JSESSIONID` comes back on the 302.
  The HUNGU flows (warm-up `GET /` and `/learn/index.php`, xmlapi login,
  xmlapi calls, pages) used the default follow behaviour and read cookies from
  the final response only.
- The HUNGU login POST sent a **JSON body** (Laravel's default body format)
  under `content-type: application/x-www-form-urlencoded; charset=UTF-8`. Core
  keeps this byte for byte, since that is what the server is known to accept.

## React Native options (Expo SDK 58)

|                       | RN global `fetch` (XHR)                                                                                                                                                                                                | `expo/fetch`                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| iOS cookie store      | `NSHTTPCookieStorage.shared` unless `withCredentials` is false                                                                                                                                                         | `HTTPCookieStorage.shared`; `credentials: 'omit'` sets `httpShouldHandleCookies = false`                                            |
| Android cookie store  | OkHttp `ReactCookieJarContainer` → `JavaNetCookieJar` over `android.webkit.CookieManager` (**shared with WebView**). OkHttp's `BridgeInterceptor` _replaces_ our `Cookie` header when the jar has cookies for the host | Same jar by default; `credentials: 'omit'` installs `CookieJar.NO_COOKIES` per call                                                 |
| Default credentials   | whatwg-fetch `same-origin` leaves RN XHR's `withCredentials = true`                                                                                                                                                    | `include` (`same-origin` is mapped to `include`)                                                                                    |
| `redirect: 'manual'`  | Not supported, always follows                                                                                                                                                                                          | Supported (iOS cancels in `willPerformHTTPRedirection`, Android `followRedirects(false)`); the 3xx is returned as a normal response |
| Repeated `Set-Cookie` | Folded into one `", "`-joined value                                                                                                                                                                                    | Android: one raw header pair each. iOS: folded by `allHeaderFields`                                                                 |

Read from `node_modules/expo/{ios,android}/…/Fetch` and the RN networking
sources. With either API's default settings, cookies from one account can
reach another account's requests through the shared native store. On Android
the WebView cookies we seed per account would also overwrite our explicit
header. RN's fetch also cannot return the 302 that the portal login needs.

## Decision

- `apps/mobile/src/platform/fetch.ts` implements core's `Fetch` with
  **`expo/fetch` and `credentials: 'omit'`**. It passes `redirect` through and
  splits folded `Set-Cookie` values (`splitSetCookieHeader`).
- `HttpTransport` (this folder) **always** calls the platform with `redirect:
'manual'` and follows redirects in JS, applying Guzzle's rules (max 5; 303,
  and 301/302 on unsafe methods, become a body-less GET). Each hop carries the
  explicit `Cookie` header only while it stays on the request's host.
- `apps/mobile/src/platform/fetch.global.ts` is a fallback on RN's fetch. It is
  used only by the probe for comparison.

### Deliberate differences from legacy

- `Set-Cookie` with `Max-Age <= 0` or an `Expires` in the past **deletes** the
  cookie. Legacy stored the value (`deleted`) as is.
- `Set-Cookie` on same-host redirect hops is merged and forwarded to the next
  hop, as a browser would do. Legacy lost it.
- After a request, cookies are merged into the **latest** stored session, not
  into the snapshot the request started from. If a re-login replaced the
  session in the meantime (ticket changed) or the session was cleared, the
  write is skipped. Legacy wrote back the snapshot, so concurrent requests
  could undo a re-login.
- Concurrent remembered re-logins for one account share a single attempt.
- The `my-profile` check right after a login does not retry on forbidden. A
  retry would start another remembered login from inside the current one.

## Verify on a device (iOS and Android)

Open the dev-only probe in a development build (`npx expo run:ios` /
`npx expo run:android`, then open `altuu://dev/transport-probe`). The route
redirects to `/` when `__DEV__` is false. Run every button once with
`Fetch: expo` and once with `Fetch: global`:

1. **Redirect probe** (needs httpbin.org or a compatible echo server):
    - `manual: status=302 … setCookies=1`. With `expo`, the manual redirect and
      the `Set-Cookie` on the 3xx are both visible. With `global`, expect 200
      here: RN's fetch cannot stop at the 302.
    - `server saw:` lists exactly `explicit` and `probe_cookie`. No other
      cookies means nothing was injected from a native store.
    - `multi:` has 2 entries. On iOS this checks the folded `Set-Cookie`
      splitting, including the comma inside `Expires`.
    - Both `native jar` lines print `{"cookies": {}}`. A non-empty jar means an
      `omit` request still stored cookies natively. Check this one
      especially on iOS, where it depends on `httpShouldHandleCookies = false`
      also suppressing storage.
2. **HUNGU login** with a real account: `login code=0`, then `my-profile
code=0` and `my-course-list code=0`. The log shows the `Cookie` header sent
   on each hop and the `Set-Cookie` received. The probe logs in with
   `kickOff=false`, so it does not kick the phone's other sessions.
3. **Portal login**: `portal login ok=true`. The POST hop shows `← 302` with
   `JSESSIONID` in `Set-Cookie`, and the next hop sends it.

If any `native jar` check is non-empty or `server saw` shows extra cookies,
the explicit-jar assumption does not hold on that platform. Report it before
building account switching on top of this transport.
