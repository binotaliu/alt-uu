package com.altuu.plugins.html_view

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.nativephp.mobile.ui.nativerender.NativeUIBridge
import com.nativephp.mobile.ui.nativerender.NativeUINode
import org.json.JSONObject
import kotlin.math.abs

/**
 * `<native:html-view>` (wire type `html_view`): sandboxed WebView for
 * foreign, already-sanitised HTML. Modelled on the stock `WebviewRenderer`
 * (same lockdown posture) and adds auto height, link-tap interception, a
 * JS-to-PHP message bridge and appearance / font-scale props. See the iOS
 * twin (AltUUHtmlViewRenderer.swift) for the contract; every event is text.
 *
 * - `on_link_tap`      JSON {"url","scheme","newWindow"}; the navigation is cancelled.
 * - `on_height_change` content height in dp/CSS px as a decimal string.
 * - `on_message`       the string the page passed to `AltUUBridge.postMessage`
 *                      (`AndroidBridge.postMessage` under the hood; needs `javascript`).
 *
 * Height measurement: with page JavaScript on, an observer script reports
 * through the `AltUUHeight` interface. With it off (the default for foreign
 * HTML), `javaScriptEnabled` is switched on ONLY for the duration of a
 * one-shot `evaluateJavascript` measurement after the page finished loading,
 * then off again, so page scripts never run while the page loads.
 *
 * NOTE: written without being compiled (no Android toolchain when authored);
 * see the verification list in docs/native-migration/conventions.md 11.5.
 */
object HtmlViewRenderer {

    @Composable
    fun Render(node: NativeUINode, modifier: Modifier) {
        val javascript = node.props.getBool("javascript", false)
        val domStorage = node.props.getBool("dom_storage", false)
        val autoHeight = node.props.getBool("auto_height", false)
        val estimatedHeight = node.props.getFloat("estimated_height", 80f)
        val userScript = node.props.getString("user_script", "")
        val messagesBound = node.props.getCallbackId("on_message") != 0

        // Native settings + JS interfaces are fixed when the WebView is
        // created, so a change to any of them rebuilds the view (the measured
        // height survives, it lives outside the key block).
        val configKey = "$javascript|$domStorage|$autoHeight|$messagesBound|$userScript"
        val measuredHeight = remember { mutableStateOf(0f) }

        val sized = if (autoHeight) {
            val height = if (measuredHeight.value > 0f) measuredHeight.value else estimatedHeight
            modifier.height(height.dp)
        } else {
            modifier
        }

        key(configKey) {
            val state = remember { HtmlViewState() }
            state.onHeight = { measuredHeight.value = it }
            state.bind(node)

            val contentKey = node.props.getString("src", "") + "\u001F" +
                node.props.getString("html", "") + "\u001F" +
                node.props.getString("base_url", "")

            AndroidView(
                modifier = sized.clipToBounds(),
                factory = { ctx ->
                    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
                    val webView = WebView(ctx).apply {
                        applyLockdownSettings(settings, javascript, domStorage)

                        // Same posture as the stock renderer: third-party
                        // cookies off. CookieManager is process-wide, so the
                        // accept flag is NOT touched (AttachmentBridge relies
                        // on cookie injection); Android cannot give this view
                        // a private cookie jar, see the docs gap list.
                        CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)

                        setBackgroundColor(0)
                        isVerticalScrollBarEnabled = !autoHeight
                        overScrollMode = if (autoHeight) android.view.View.OVER_SCROLL_NEVER else android.view.View.OVER_SCROLL_IF_CONTENT_SCROLLS

                        webViewClient = HtmlViewClient(state, userScript)
                        webChromeClient = HtmlViewChromeClient(state)

                        if (javascript) {
                            addJavascriptInterface(MessageBridge(state), "AndroidBridge")
                            addJavascriptInterface(HeightBridge(state), "AltUUHeight")
                        }
                    }

                    webView.tag = contentKey
                    state.load(webView)
                    webView
                },
                update = { webView ->
                    state.bind(node)
                    applyColorScheme(webView)
                    webView.settings.textZoom = (node.props.getFloat("font_scale", 1f).coerceIn(0.5f, 3f) * 100f).toInt()

                    if (webView.tag != contentKey) {
                        webView.tag = contentKey
                        state.load(webView)
                    }
                },
                onRelease = { webView ->
                    state.released = true
                    webView.stopLoading()
                    webView.removeJavascriptInterface("AndroidBridge")
                    webView.removeJavascriptInterface("AltUUHeight")
                    webView.webViewClient = WebViewClient()
                    webView.webChromeClient = null
                    webView.destroy()
                }
            )
        }
    }
}

/**
 * Long-lived, mutable dispatch state shared by the clients and JS interfaces.
 * Only callback ids / node id / content live here; none of it takes part in
 * the reload decision, so re-binding on recomposition can never reload.
 */
private class HtmlViewState {
    @Volatile var nodeId: Int = 0
    @Volatile var linkTapCallbackId: Int = 0
    @Volatile var heightCallbackId: Int = 0
    @Volatile var messageCallbackId: Int = 0
    @Volatile var released: Boolean = false

    var onHeight: (Float) -> Unit = {}
    var autoHeight: Boolean = false
    var javascript: Boolean = false
    var src: String = ""
    var html: String = ""
    var baseUrl: String = ""
    var measuring: Boolean = false
    var lastReportedHeight: Float = 0f

    private val mainHandler = Handler(Looper.getMainLooper())

    fun bind(node: NativeUINode) {
        nodeId = node.id
        linkTapCallbackId = node.props.getCallbackId("on_link_tap")
        heightCallbackId = node.props.getCallbackId("on_height_change")
        messageCallbackId = node.props.getCallbackId("on_message")
        autoHeight = node.props.getBool("auto_height", false)
        javascript = node.props.getBool("javascript", false)
        src = node.props.getString("src", "")
        html = node.props.getString("html", "")
        baseUrl = node.props.getString("base_url", "")
    }

    fun load(webView: WebView) {
        lastReportedHeight = 0f

        if (html.isNotEmpty()) {
            // null base URL = opaque origin (cannot touch the host app).
            val base = baseUrl.takeIf { isLoadableUrl(it) }
            webView.loadDataWithBaseURL(base, html, "text/html", "utf-8", null)
            return
        }

        if (src.isNotEmpty() && isLoadableUrl(src)) {
            webView.loadUrl(src)
        }
    }

    fun reportLinkTap(url: String, newWindow: Boolean) {
        if (linkTapCallbackId == 0) return

        val payload = JSONObject()
            .put("url", url)
            .put("scheme", (Uri.parse(url).scheme ?: "").lowercase())
            .put("newWindow", newWindow)

        NativeUIBridge.sendTextChangeEvent(linkTapCallbackId, nodeId, payload.toString())
    }

    fun reportMessage(text: String) {
        if (messageCallbackId == 0 || text.length > 262_144) return
        NativeUIBridge.sendTextChangeEvent(messageCallbackId, nodeId, text)
    }

    /** Adopts a measured height natively and (throttled) tells PHP. Any thread. */
    fun reportHeight(height: Float) {
        if (released || !height.isFinite() || height < 0f) return

        mainHandler.post {
            if (released) return@post
            onHeight(height)

            // Informational PHP event: every event costs a full PHP render
            // and tree publish, so ignore sub-2dp jitter.
            if (heightCallbackId != 0 && abs(lastReportedHeight - height) >= 2f) {
                lastReportedHeight = height
                NativeUIBridge.sendTextChangeEvent(heightCallbackId, nodeId, String.format(java.util.Locale.US, "%.1f", height))
            }
        }
    }

    /**
     * One-shot height measurement. With page JS off, JS is enabled just for
     * the evaluation (page scripts are stripped upstream and blocked by CSP
     * anyway) and switched off again in the callback.
     */
    fun measure(view: WebView) {
        if (released || (!autoHeight && heightCallbackId == 0)) return

        if (javascript) {
            view.evaluateJavascript(MEASURE_JS) { value -> handleMeasured(value) }
            return
        }

        if (measuring) return
        measuring = true
        view.settings.javaScriptEnabled = true
        view.evaluateJavascript(MEASURE_JS) { value ->
            if (!released) {
                view.settings.javaScriptEnabled = false
            }
            measuring = false
            handleMeasured(value)
        }
    }

    private fun handleMeasured(value: String?) {
        val height = value?.trim('"')?.toFloatOrNull() ?: return
        if (height >= 0f) reportHeight(height)
    }

    companion object {
        /** Body border-box height, NOT documentElement.scrollHeight (never below the viewport). */
        const val MEASURE_JS = "(function(){var b=document.body;if(!b){return -1;}var s=getComputedStyle(b);" +
            "return Math.ceil(b.getBoundingClientRect().height+(parseFloat(s.marginTop)||0)+(parseFloat(s.marginBottom)||0));})()"

        const val OBSERVER_JS = "(function(){if(window.__altuuObserve){return;}window.__altuuObserve=true;var last=-1;" +
            "function m(){var b=document.body;if(!b){return;}var s=getComputedStyle(b);" +
            "var v=Math.ceil(b.getBoundingClientRect().height+(parseFloat(s.marginTop)||0)+(parseFloat(s.marginBottom)||0));" +
            "if(v!==last){last=v;AltUUHeight.report(v);}}" +
            "if(window.ResizeObserver&&document.body){new ResizeObserver(m).observe(document.body);}" +
            "document.addEventListener('load',m,true);window.addEventListener('load',m);window.addEventListener('resize',m);m();})();"

        const val BRIDGE_JS = "(function(){if(window.AltUUBridge){return;}window.AltUUBridge={postMessage:function(p){" +
            "var t=typeof p==='string'?p:JSON.stringify(p);if(window.AndroidBridge){window.AndroidBridge.postMessage(t);}}};})();"
    }
}

private class MessageBridge(private val state: HtmlViewState) {
    @JavascriptInterface
    fun postMessage(text: String) {
        state.reportMessage(text)
    }
}

private class HeightBridge(private val state: HtmlViewState) {
    @JavascriptInterface
    fun report(height: Double) {
        state.reportHeight(height.toFloat())
    }
}

private class HtmlViewClient(
    private val state: HtmlViewState,
    private val userScript: String
) : WebViewClient() {

    private val handler = Handler(Looper.getMainLooper())

    /**
     * loadUrl / loadDataWithBaseURL never come through here, so every call
     * for the main frame is a user-visible navigation: a tapped link, a
     * scripted redirect or a form post. HTTP redirects of a `src` page stay
     * in place. Everything else is cancelled and reported; PHP decides.
     */
    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        if (!request.isForMainFrame) return false
        if (request.isRedirect && state.src.isNotEmpty()) return false

        state.reportLinkTap(request.url?.toString() ?: return true, newWindow = false)
        return true
    }

    override fun onPageCommitVisible(view: WebView?, url: String?) {
        injectPageScripts(view)
    }

    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        // Deliberately empty: the document may not exist yet. Scripts are
        // injected on commit and again on finish (both idempotent).
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        if (view == null) return
        injectPageScripts(view)
        state.measure(view)

        if (!state.javascript) {
            // Late images / fonts: re-measure a couple of times.
            handler.postDelayed({ state.measure(view) }, 300)
            handler.postDelayed({ state.measure(view) }, 1200)
        }
    }

    private fun injectPageScripts(view: WebView?) {
        if (view == null || !state.javascript) return

        view.evaluateJavascript(HtmlViewState.BRIDGE_JS, null)
        view.evaluateJavascript(HtmlViewState.OBSERVER_JS, null)

        if (userScript.isNotEmpty()) {
            // Idempotent: commit and finish both inject.
            view.evaluateJavascript("(function(){if(window.__altuuUserScript){return;}window.__altuuUserScript=true;\n$userScript\n})();", null)
        }
    }

    override fun onRenderProcessGone(view: WebView?, detail: android.webkit.RenderProcessGoneDetail?): Boolean {
        // Returning true keeps the app alive; the view stays blank until PHP
        // re-renders it with a different content signature.
        return true
    }
}

private class HtmlViewChromeClient(private val state: HtmlViewState) : WebChromeClient() {
    override fun onCreateWindow(
        view: WebView,
        isDialog: Boolean,
        isUserGesture: Boolean,
        resultMsg: Message?
    ): Boolean {
        // target=_blank / window.open(): hand the request a throwaway
        // WebView, capture the URL it tries to load, report it and drop it.
        val message = resultMsg ?: return false
        val transport = message.obj as? WebView.WebViewTransport ?: return false
        val throwaway = WebView(view.context)

        throwaway.webViewClient = object : WebViewClient() {
            private var reported = false

            private fun report(target: String?) {
                if (reported || target.isNullOrEmpty() || target == "about:blank") return
                reported = true
                state.reportLinkTap(target, newWindow = true)
                view.post {
                    throwaway.stopLoading()
                    throwaway.destroy()
                }
            }

            override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                report(request.url?.toString())
                return true
            }

            override fun onPageStarted(v: WebView?, url: String?, favicon: Bitmap?) {
                report(url)
            }
        }

        transport.webView = throwaway
        message.sendToTarget()
        return true
    }
}

private fun applyColorScheme(webView: WebView) {
    // Foreign HTML gets explicit colours from the host document (plus a
    // `color-scheme` declaration), so the platform must not darken it a
    // second time. A forced scheme therefore only takes effect through that
    // document on Android (iOS also overrides the trait collection).
    if (Build.VERSION.SDK_INT >= 33) {
        webView.settings.isAlgorithmicDarkeningAllowed = false
    }
}

private fun applyLockdownSettings(settings: WebSettings, javascript: Boolean, domStorage: Boolean) {
    settings.javaScriptEnabled = javascript
    settings.domStorageEnabled = domStorage
    settings.allowFileAccess = false
    settings.allowContentAccess = false
    @Suppress("DEPRECATION")
    settings.allowFileAccessFromFileURLs = false
    @Suppress("DEPRECATION")
    settings.allowUniversalAccessFromFileURLs = false
    settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
    settings.javaScriptCanOpenWindowsAutomatically = false
    // Needed so target=_blank reaches onCreateWindow instead of navigating
    // this view; the created window is never shown (see HtmlViewChromeClient).
    settings.setSupportMultipleWindows(true)
    settings.mediaPlaybackRequiresUserGesture = true
    settings.setGeolocationEnabled(false)
    @Suppress("DEPRECATION")
    settings.databaseEnabled = false
    settings.cacheMode = WebSettings.LOAD_NO_CACHE
}

private fun isLoadableUrl(url: String): Boolean {
    val scheme = Uri.parse(url).scheme?.lowercase() ?: return false
    return scheme == "https" || scheme == "http"
}
