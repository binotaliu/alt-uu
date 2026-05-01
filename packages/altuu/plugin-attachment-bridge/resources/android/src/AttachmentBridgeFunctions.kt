package com.altuu.plugins.attachment_bridge

import android.app.AlertDialog
import android.app.Activity
import android.app.Dialog
import android.content.Intent
import android.util.Base64
import android.util.Log
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.view.Gravity
import android.view.KeyEvent
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.MimeTypeMap
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.fragment.app.FragmentActivity
import com.nativephp.mobile.bridge.BridgeError
import com.nativephp.mobile.bridge.BridgeFunction
import com.nativephp.mobile.bridge.PHPBridge
import com.nativephp.mobile.bridge.BridgeResponse
import com.nativephp.mobile.network.PHPRequest
import com.nativephp.mobile.security.LaravelCookieStore
import com.nativephp.mobile.security.LaravelSecurity
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLDecoder
import java.net.URLEncoder
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

object AttachmentBridgeFunctions {

    private const val TAG = "AttachmentBridge"
    private const val HUNGU_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    private fun ts(): String = System.currentTimeMillis().toString()

    private fun normalizeBridgeValue(value: Any?): Any? {
        return when (value) {
            null, JSONObject.NULL -> null
            is JSONObject -> {
                val map = mutableMapOf<String, Any>()
                val keys = value.keys()
                while (keys.hasNext()) {
                    val nestedKey = keys.next()
                    val normalizedValue = normalizeBridgeValue(value.opt(nestedKey))
                    if (normalizedValue != null) {
                        map[nestedKey] = normalizedValue
                    }
                }
                map
            }
            is JSONArray -> {
                buildList {
                    for (index in 0 until value.length()) {
                        val normalizedValue = normalizeBridgeValue(value.opt(index))
                        if (normalizedValue != null) {
                            add(normalizedValue)
                        }
                    }
                }
            }
            else -> value
        }
    }

    private fun getObjectParameter(parameters: Map<String, Any>, key: String): Map<String, Any>? {
        val rawValue = normalizeBridgeValue(parameters[key]) ?: return null

        return rawValue.toStringKeyedMap()
    }

    private fun getObjectListParameter(parameters: Map<String, Any>, key: String): List<Map<String, Any>> {
        val rawValue = normalizeBridgeValue(parameters[key]) ?: return emptyList()

        return when (rawValue) {
            is List<*> -> rawValue.mapNotNull { item ->
                item.toStringKeyedMap()
            }
            else -> emptyList()
        }
    }

    private fun Any?.toStringKeyedMap(): Map<String, Any>? {
        return when (this) {
            is Map<*, *> -> this.entries
                .mapNotNull { entry ->
                    val mapKey = entry.key as? String ?: return@mapNotNull null
                    val mapValue = entry.value ?: return@mapNotNull null
                    mapKey to mapValue
                }
                .toMap()
            else -> null
        }
    }

    // region Bridge Functions

    class Download(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val url = parameters["url"] as? String
                ?: throw BridgeError.InvalidParameters("Missing url parameter")
            val filename = parameters["filename"] as? String
            val displayName = normalizeFilename(filename ?: url.substringAfterLast("/"))

            mainHandler.post {
                AlertDialog.Builder(activity)
                    .setTitle("下載附件")
                    .setMessage("是否下載 $displayName？")
                    .setPositiveButton("下載") { _, _ ->
                        fetchAndPresent(activity, url, filename)
                    }
                    .setNegativeButton("取消", null)
                    .show()
            }

            return BridgeResponse.success(mapOf(
                "queued" to true,
                "platform" to "android"
            ))
        }
    }

    class OpenURL(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val url = parameters["url"] as? String
                ?: throw BridgeError.InvalidParameters("Missing url parameter")

            val cookies = getObjectListParameter(parameters, "cookies")
            val method = (parameters["method"] as? String ?: "GET").uppercase()

            val postForm = if (method == "POST") {
                getObjectParameter(parameters, "postForm")
            } else null

            mainHandler.post {
                showInAppBrowser(activity, url, cookies, postForm)
            }

            return BridgeResponse.success(mapOf(
                "opened" to true,
                "platform" to "android"
            ))
        }
    }

    class OpenInBrowser(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            return OpenURL(activity).execute(parameters)
        }
    }

    class OpenTronclass(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val url = parameters["url"] as? String
                ?: throw BridgeError.InvalidParameters("Missing url parameter")
            if (url.isEmpty()) throw BridgeError.InvalidParameters("Missing url parameter")

            mainHandler.post {
                try {
                    activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                } catch (_: Exception) {
                    // tronclass app not installed
                }
            }

            return BridgeResponse.success(mapOf(
                "opened" to true,
                "platform" to "android"
            ))
        }
    }

    class OpenDiscussAttachment(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val cid = parameters["cid"] as? String
                ?: throw BridgeError.InvalidParameters("Missing cid parameter")
            val bid = parameters["bid"] as? String
                ?: throw BridgeError.InvalidParameters("Missing bid parameter")
            val nid = parameters["nid"] as? String
                ?: throw BridgeError.InvalidParameters("Missing nid parameter")
            val attachmentUrl = parameters["attachmentUrl"] as? String
                ?: throw BridgeError.InvalidParameters("Missing attachmentUrl parameter")

            if (cid.isEmpty() || bid.isEmpty() || nid.isEmpty() || attachmentUrl.isEmpty()) {
                throw BridgeError.InvalidParameters("Parameters must not be empty")
            }

            val cookies = getObjectListParameter(parameters, "cookies")

            val threadUrl = "https://uu.nou.edu.tw/forum/m_node_chain.php"
            val postForm = mapOf<String, Any>("cid" to cid, "bid" to bid, "nid" to nid)

            mainHandler.post {
                showInAppBrowser(activity, threadUrl, cookies, postForm, attachmentUrl)
            }

            return BridgeResponse.success(mapOf(
                "opened" to true,
                "platform" to "android"
            ))
        }
    }

    class OpenLocalFile(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val path = (parameters["path"] as? String)?.trim()
                ?: throw BridgeError.InvalidParameters("Missing path parameter")

            val mimeType = (parameters["mimeType"] as? String)?.trim()?.takeIf { it.isNotEmpty() }

            mainHandler.post {
                openExistingLocalFile(activity, path, mimeType)
            }

            return BridgeResponse.success(mapOf(
                "opened" to true,
                "platform" to "android"
            ))
        }
    }

    // endregion

    // region Download Helpers

    private fun fetchAndPresent(activity: FragmentActivity, urlString: String, preferredFilename: String?) {
        executor.execute {
            try {
                if (shouldUseNativePhpBridge(urlString)) {
                    fetchAndPresentViaPhpBridge(activity, urlString, preferredFilename)
                    return@execute
                }

                val url = URL(urlString)
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.instanceFollowRedirects = true
                connection.connectTimeout = 30_000
                connection.readTimeout = 30_000
                connection.connect()

                if (connection.responseCode !in 200..299) {
                    showError(activity, "下載失敗 (HTTP ${connection.responseCode})")
                    return@execute
                }

                val contentDisposition = connection.getHeaderField("Content-Disposition")
                val contentType = connection.contentType ?: "application/octet-stream"
                val resolvedName = resolveFilename(contentDisposition, urlString, preferredFilename)

                val tempFile = File(activity.cacheDir, "${UUID.randomUUID()}-$resolvedName")
                connection.inputStream.use { input ->
                    FileOutputStream(tempFile).use { output ->
                        input.copyTo(output)
                    }
                }
                connection.disconnect()

                mainHandler.post { presentActionSheet(activity, tempFile, contentType) }
            } catch (e: Exception) {
                showError(activity, e.localizedMessage ?: "下載失敗")
            }
        }
    }

    private fun fetchAndPresentViaPhpBridge(activity: FragmentActivity, urlString: String, preferredFilename: String?) {
        val phpBridge = resolvePhpBridgeFromActivity(activity)
        val requestUri = toLocalPhpUri(urlString)
        val requestHeaders = mutableMapOf<String, String>("Accept" to "*/*")

        LaravelSecurity.applyToHeaders(requestHeaders)
        requestHeaders["Cookie"] = LaravelCookieStore.asCookieHeader()

        val phpRequest = PHPRequest(
            url = requestUri.encodedPath ?: "/",
            method = "GET",
            body = "",
            headers = requestHeaders,
            getParameters = requestUri.queryParameterNames?.associateWith {
                requestUri.getQueryParameter(it) ?: ""
            } ?: emptyMap()
        )

        val (responseHeaders, responseBody, statusCode) = parseRawResponse(phpBridge.handleLaravelRequest(phpRequest))
        val sanitizedHeaders = responseHeaders.toMutableMap()
        val bodyBytes = decodeResponseBody(sanitizedHeaders, responseBody)

        if (statusCode !in 200..299) {
            throw IllegalStateException("下載失敗 (HTTP $statusCode)")
        }

        val contentDisposition = getHeaderIgnoreCase(responseHeaders, "Content-Disposition")
        val contentType = (getHeaderIgnoreCase(responseHeaders, "Content-Type") ?: "application/octet-stream")
            .substringBefore(';')
            .trim()
            .ifEmpty { "application/octet-stream" }
        val resolvedName = resolveFilename(contentDisposition, urlString, preferredFilename)

        val tempFile = File(activity.cacheDir, "${UUID.randomUUID()}-$resolvedName")
        FileOutputStream(tempFile).use { output ->
            output.write(bodyBytes)
        }

        mainHandler.post { presentActionSheet(activity, tempFile, contentType) }
    }

    private fun resolvePhpBridgeFromActivity(activity: FragmentActivity): PHPBridge {
        var current: Class<*>? = activity.javaClass

        while (current != null) {
            try {
                val field = current.getDeclaredField("phpBridge")
                field.isAccessible = true

                val value = field.get(activity)
                if (value is PHPBridge) {
                    return value
                }

                break
            } catch (_: NoSuchFieldException) {
                current = current.superclass
            }
        }

        throw IllegalStateException("AttachmentBridge local download requires MainActivity phpBridge")
    }

    private fun parseRawResponse(rawResponse: String): Triple<Map<String, String>, String, Int> {
        val headers = mutableMapOf<String, String>()
        var statusCode = 200
        var body = ""

        val parts = rawResponse.split("\r\n\r\n", limit = 2)
        if (parts.size < 2) {
            return Triple(headers, rawResponse.trim(), statusCode)
        }

        val headerLines = parts[0].split("\r\n")
        body = parts[1]

        val statusLine = headerLines.firstOrNull()
        if (statusLine != null && statusLine.startsWith("HTTP/")) {
            val statusParts = statusLine.split(" ")
            if (statusParts.size >= 2) {
                statusCode = statusParts[1].toIntOrNull() ?: statusCode
            }
        }

        for (i in 1 until headerLines.size) {
            val line = headerLines[i]
            val colonIndex = line.indexOf(":")
            if (colonIndex > 0) {
                val key = line.substring(0, colonIndex).trim()
                val value = line.substring(colonIndex + 1).trim()
                if (key.equals("Set-Cookie", ignoreCase = true)) {
                    headers.merge(key, value) { old, new -> "$old\n$new" }
                } else {
                    headers[key] = value
                }
            }
        }

        headers.entries
            .filter { it.key.equals("Set-Cookie", ignoreCase = true) }
            .flatMap { it.value.split("\n") }
            .forEach { cookie ->
                LaravelCookieStore.storeFromSetCookieHeader(cookie)
                CookieManager.getInstance().setCookie("http://127.0.0.1", cookie)
            }

        CookieManager.getInstance().flush()

        return Triple(headers, body.trim(), statusCode)
    }

    private fun decodeResponseBody(headers: MutableMap<String, String>, body: String): ByteArray {
        val encodingKey = headers.keys.firstOrNull { it.equals("X-Body-Encoding", ignoreCase = true) }
        val encodingValue = encodingKey?.let { headers[it]?.trim()?.lowercase() }

        if (encodingKey != null) {
            headers.remove(encodingKey)
        }

        if (encodingValue == "base64") {
            return try {
                Base64.decode(body.trim(), Base64.DEFAULT)
            } catch (e: IllegalArgumentException) {
                Log.e(TAG, "Failed to decode base64 body for attachment", e)
                ByteArray(0)
            }
        }

        return body.toByteArray(Charsets.UTF_8)
    }

    private fun presentActionSheet(activity: FragmentActivity, file: File, mimeType: String) {
        val displayName = file.name.substringAfter("-") // strip UUID prefix
        val canPreview = mimeType.startsWith("image/") ||
                mimeType == "application/pdf" ||
                mimeType.startsWith("text/")

        val builder = AlertDialog.Builder(activity)
            .setTitle("附件下載完成")
            .setMessage(displayName)

        if (canPreview) {
            builder.setPositiveButton("檢視") { _, _ -> viewFile(activity, file, mimeType) }
        }

        builder.setNeutralButton("儲存") { _, _ -> saveFileWithPicker(activity, file, mimeType) }
        builder.setNegativeButton("取消", null)
        builder.show()
    }

    private fun openExistingLocalFile(activity: FragmentActivity, path: String, mimeType: String?) {
        val file = File(path)

        if (!file.exists() || !file.isFile) {
            showError(activity, "找不到附件檔案")
            return
        }

        val resolvedMimeType = mimeType ?: guessMimeType(file)
        viewFile(activity, file, resolvedMimeType)
    }

    private fun guessMimeType(file: File): String {
        val extension = file.extension.lowercase()

        if (extension.isEmpty()) {
            return "application/octet-stream"
        }

        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension)
            ?: "application/octet-stream"
    }

    private fun viewFile(activity: FragmentActivity, file: File, mimeType: String) {
        val safeMimeType = mimeType.ifBlank { "application/octet-stream" }

        try {
            val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, safeMimeType)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val resolvedActivity = intent.resolveActivity(activity.packageManager)
            if (resolvedActivity == null) {
                saveFileWithPicker(activity, file, safeMimeType)
                return
            }

            activity.startActivity(intent)
        } catch (_: Exception) {
            saveFileWithPicker(activity, file, safeMimeType)
        }
    }

    private fun saveFileWithPicker(activity: FragmentActivity, file: File, mimeType: String) {
        val suggestedFileName = file.name.substringAfter("-").ifBlank { "attachment.bin" }
        val safeMimeType = mimeType.ifBlank { "application/octet-stream" }

        launchCreateDocumentPicker(activity, suggestedFileName, safeMimeType) { destinationUri ->
            if (destinationUri == null) {
                return@launchCreateDocumentPicker
            }

            executor.execute {
                try {
                    val resolver = activity.contentResolver
                    resolver.openOutputStream(destinationUri, "w")?.use { output ->
                        file.inputStream().use { input ->
                            input.copyTo(output)
                        }
                    } ?: throw IllegalStateException("無法開啟儲存位置")

                    mainHandler.post {
                        AlertDialog.Builder(activity)
                            .setTitle("附件已儲存")
                            .setMessage("已儲存至你選擇的位置")
                            .setPositiveButton("確定", null)
                            .show()
                    }
                } catch (e: Exception) {
                    showError(activity, e.localizedMessage ?: "無法儲存檔案")
                }
            }
        }
    }

    private fun launchCreateDocumentPicker(
        activity: FragmentActivity,
        suggestedFileName: String,
        mimeType: String,
        onResult: (Uri?) -> Unit
    ) {
        val requestKey = "attachment-save-${UUID.randomUUID()}"
        lateinit var launcher: ActivityResultLauncher<Intent>

        launcher = activity.activityResultRegistry.register(
            requestKey,
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            val destinationUri =
                if (result.resultCode == Activity.RESULT_OK) result.data?.data else null

            onResult(destinationUri)
            launcher.unregister()
        }

        val createDocumentIntent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = mimeType.ifBlank { "application/octet-stream" }
            putExtra(Intent.EXTRA_TITLE, suggestedFileName)
        }

        try {
            launcher.launch(createDocumentIntent)
        } catch (_: Exception) {
            launcher.unregister()
            onResult(null)
            showError(activity, "無法開啟儲存位置選擇器")
        }
    }

    // endregion

    // region In-App Browser

    private fun showInAppBrowser(
        activity: FragmentActivity,
        urlString: String,
        cookiesPayload: List<Map<String, Any>>,
        postForm: Map<String, Any>? = null,
        autoClickAttachmentUrl: String? = null
    ) {
        val dialog = Dialog(activity, android.R.style.Theme_DeviceDefault_NoActionBar)

        val root = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        // Toolbar
        val isNightMode = (activity.resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES
        val toolbarBackgroundColor = if (isNightMode) android.graphics.Color.parseColor("#212121") else android.graphics.Color.parseColor("#F5F5F5")
        val toolbarTitleTextColor = if (isNightMode) android.graphics.Color.WHITE else android.graphics.Color.BLACK

        val toolbar = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(24, 16, 24, 16)
            minimumHeight = 56
            setBackgroundColor(toolbarBackgroundColor)
        }

        val doneButton = TextView(activity).apply {
            text = "完成"
            textSize = 16f
            setPadding(16, 12, 16, 12)
            setTextColor(toolbarTitleTextColor)
            setOnClickListener { dialog.dismiss() }
        }

        val titleView = TextView(activity).apply {
            text = "App 內瀏覽器"
            textSize = 16f
            gravity = Gravity.CENTER
            maxLines = 1
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            setTextColor(toolbarTitleTextColor)
        }

        val shareButton = TextView(activity).apply {
            text = "分享"
            textSize = 16f
            setPadding(16, 12, 16, 12)
            setTextColor(toolbarTitleTextColor)
        }

        toolbar.addView(doneButton)
        toolbar.addView(titleView)
        toolbar.addView(shareButton)

        // Progress bar
        val progressBar = ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal).apply {
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 4)
            max = 100
            progress = 0
        }

        // WebView
        val webView = WebView(activity).apply {
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
            userAgentString = HUNGU_USER_AGENT
        }

        val webViewUserAgent = webView.settings.userAgentString

        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                progressBar.visibility = if (newProgress in 1..99) android.view.View.VISIBLE else android.view.View.GONE
            }

            override fun onReceivedTitle(view: WebView?, title: String?) {
                titleView.text = title?.takeIf { it.isNotBlank() } ?: "App 內瀏覽器"
            }

            override fun onJsAlert(
                view: WebView?,
                url: String?,
                message: String?,
                result: JsResult
            ): Boolean {
                AlertDialog.Builder(activity)
                    .setMessage(message ?: "")
                    .setCancelable(false)
                    .setPositiveButton("確定") { _, _ ->
                        result.confirm()
                    }
                    .setOnCancelListener {
                        result.cancel()
                    }
                    .show()

                return true
            }

            override fun onJsConfirm(
                view: WebView?,
                url: String?,
                message: String?,
                result: JsResult
            ): Boolean {
                AlertDialog.Builder(activity)
                    .setMessage(message ?: "")
                    .setCancelable(false)
                    .setPositiveButton("確定") { _, _ ->
                        result.confirm()
                    }
                    .setNegativeButton("取消") { _, _ ->
                        result.cancel()
                    }
                    .setOnCancelListener {
                        result.cancel()
                    }
                    .show()

                return true
            }

            override fun onJsPrompt(
                view: WebView?,
                url: String?,
                message: String?,
                defaultValue: String?,
                result: JsPromptResult
            ): Boolean {
                val input = EditText(activity).apply {
                    setText(defaultValue ?: "")
                    setSelection(text.length)
                }

                AlertDialog.Builder(activity)
                    .setMessage(message ?: "")
                    .setView(input)
                    .setCancelable(false)
                    .setPositiveButton("確定") { _, _ ->
                        result.confirm(input.text.toString())
                    }
                    .setNegativeButton("取消") { _, _ ->
                        result.cancel()
                    }
                    .setOnCancelListener {
                        result.cancel()
                    }
                    .show()

                return true
            }

            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message?
            ): Boolean {
                val transport = resultMsg?.obj as? WebView.WebViewTransport ?: return false
                // Route popup/_blank navigations back into the same in-app browser WebView.
                transport.webView = webView
                resultMsg.sendToTarget()
                return true
            }
        }

        var autoClickAttempts = 0
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                return super.shouldInterceptRequest(view, request)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)

                if (!autoClickAttachmentUrl.isNullOrEmpty() && autoClickAttempts < 3) {
                    autoClickAttempts++
                    autoClickLink(view, autoClickAttachmentUrl)
                }
            }
        }

        webView.setDownloadListener(DownloadListener { downloadUrl, _, _, _, _ ->
            try {
                activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl)))
            } catch (_: Exception) {}
        })

        shareButton.setOnClickListener {
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, webView.url ?: urlString)
            }
            activity.startActivity(Intent.createChooser(intent, "分享"))
        }

        // Handle back button for WebView navigation
        dialog.setOnKeyListener { _, keyCode, event ->
            if (keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_UP) {
                if (webView.canGoBack()) {
                    webView.goBack()
                    true
                } else {
                    dialog.dismiss()
                    true
                }
            } else {
                false
            }
        }

        root.addView(toolbar)
        root.addView(progressBar)
        root.addView(webView)

        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        dialog.setContentView(root)

        // Enable edge-to-edge on the dialog window so it draws behind status bar / nav bar.
        // Without this, on Android 15+ the dialog still extends behind system bars but the
        // insets may not be dispatched properly to the view hierarchy.
        dialog.window?.let { dialogWindow ->
            WindowCompat.setDecorFitsSystemWindows(dialogWindow, false)
        }

        // Immediately apply the activity's current insets so the toolbar is not hidden under
        // the status bar even before the asynchronous insets dispatch fires.
        val activityInsets = ViewCompat.getRootWindowInsets(activity.window.decorView)
        val systemBars = activityInsets?.getInsets(WindowInsetsCompat.Type.systemBars())
        if (systemBars != null) {
            root.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
        } else {
            Log.w(TAG, "InAppBrowser: Could not read activity window insets — safe area may be incorrect")
        }

        injectCookiesAndLoad(webView, urlString, cookiesPayload, postForm)

        dialog.setOnDismissListener { webView.destroy() }
        dialog.show()
        // Request a fresh insets pass after show() so the listener above can update if needed.
        ViewCompat.requestApplyInsets(root)
    }

    private fun injectCookiesAndLoad(
        webView: WebView,
        urlString: String,
        cookiesPayload: List<Map<String, Any>>,
        postForm: Map<String, Any>?
    ) {
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)


        val cookiePairs = cookiesPayload.mapNotNull { toCookiePair(it) }

        clearExistingCookiesForPayload(cookieManager, cookiePairs)

        if (cookiePairs.isEmpty()) {
            // small delay to ensure UI is stable before loading
            mainHandler.post {
                loadBrowserRequest(webView, urlString, postForm, cookiesPayload)
            }
            return
        }

        // Use AtomicInteger for thread-safe remaining counter because callbacks may arrive concurrently
        val remaining = AtomicInteger(cookiePairs.size)

        // Check URL scheme for Secure cookie diagnostics
        val targetScheme = try { Uri.parse(urlString).scheme?.lowercase() } catch (_: Exception) { null }
        val hasSecureCookie = cookiePairs.any { it.second.contains("; Secure", ignoreCase = true) }
        if (hasSecureCookie && targetScheme != "https") {
            Log.w(TAG, "InAppBrowser: Target URL scheme is not https but cookies include Secure flag — cookies won't be sent over HTTP. targetScheme=$targetScheme")
        }

        cookiePairs.forEachIndexed { index, (cookieUrl, cookieValue) ->
            val cookieName = cookieValue.substringBefore('=').trim()
            cookieManager.setCookie(cookieUrl, cookieValue) { success ->
                val rem = remaining.decrementAndGet()

                if (rem <= 0) {
                    // Ensure WebView operations happen on main thread; add a small delay to avoid timing races
                    mainHandler.postDelayed({
                        cookieManager.flush()

                        // Log cookies for various domains to aid debugging
                        try {
                            val uri = Uri.parse(urlString)
                            val host = uri.host ?: ""
                            val httpForHost = "http://$host"
                            val httpsForHost = "https://$host"

                            val cookiesForRequestUrl = cookieManager.getCookie(urlString)
                            val cookiesForHttpHost = cookieManager.getCookie(httpForHost)
                            val cookiesForHttpsHost = cookieManager.getCookie(httpsForHost)

                        } catch (e: Exception) {
                            Log.w(TAG, "InAppBrowser: Failed to log cookie snapshots: ${e.message}")
                        }

                        loadBrowserRequest(webView, urlString, postForm, cookiesPayload)
                    }, 200L)
                }
            }
        }
    }

    private fun loadBrowserRequest(
        webView: WebView,
        urlString: String,
        postForm: Map<String, Any>?,
        cookiesPayload: List<Map<String, Any>>
    ) {
        if (postForm != null && postForm.isNotEmpty()) {
            val formBody = postForm.entries
                .sortedBy { it.key }
                .joinToString("&") { (key, value) ->
                    "${URLEncoder.encode(key, "UTF-8") }=${URLEncoder.encode(value.toString(), "UTF-8") }"
                }
            webView.postUrl(urlString, formBody.toByteArray(Charsets.UTF_8))
        } else {
            val explicitCookieHeader = buildExplicitCookieHeader(cookiesPayload)
            if (explicitCookieHeader.isNotEmpty()) {
                val requestHeaders = mutableMapOf<String, String>(
                    "Cookie" to explicitCookieHeader
                )

                val referer = buildReferer(urlString)
                if (referer != null) {
                    requestHeaders["Referer"] = referer
                }

                webView.loadUrl(urlString, requestHeaders)
            } else {
                webView.loadUrl(urlString)
            }
        }
    }

    private fun clearExistingCookiesForPayload(
        cookieManager: CookieManager,
        cookiePairs: List<Pair<String, String>>
    ) {
        cookiePairs.forEach { (cookieUrl, cookieValue) ->
            val cookieName = cookieValue.substringBefore('=').trim()
            val domain = cookieValue.substringAfter("Domain=", "")
                .substringBefore(';')
                .trim()
            val path = cookieValue.substringAfter("Path=", "/")
                .substringBefore(';')
                .trim()

            if (cookieName.isEmpty() || domain.isEmpty()) {
                return@forEach
            }

            val deleteCookieValue = "$cookieName=; Domain=$domain; Path=$path; Max-Age=0"
            cookieManager.setCookie(cookieUrl, deleteCookieValue)

            val hostOnlyDeleteValue = "$cookieName=; Path=$path; Max-Age=0"
            cookieManager.setCookie(cookieUrl, hostOnlyDeleteValue)

        }

        cookieManager.flush()
    }

    private fun buildExplicitCookieHeader(cookiesPayload: List<Map<String, Any>>): String {
        val deduped = linkedMapOf<String, String>()

        cookiesPayload.forEach { item ->
            val name = item["name"] as? String ?: return@forEach
            val value = item["value"] as? String ?: return@forEach
            val domain = (item["domain"] as? String).orEmpty()
            val path = ((item["path"] as? String)?.takeIf { it.isNotBlank() } ?: "/")

            if (name.isBlank()) {
                return@forEach
            }

            val dedupeKey = "${name.trim().lowercase()}|${domain.trim().lowercase()}|${path.trim()}"
            deduped[dedupeKey] = "${name.trim()}=$value"
        }

        val header = deduped.values.joinToString("; ")
        return header
    }

    private fun buildReferer(urlString: String): String? {
        return try {
            val uri = Uri.parse(urlString)
            val scheme = uri.scheme ?: return null
            val host = uri.host ?: return null
            val port = if (uri.port > 0) ":${uri.port}" else ""
            "$scheme://$host$port/"
        } catch (_: Exception) {
            null
        }
    }

    private fun toCookiePair(item: Map<String, Any>): Pair<String, String>? {
        val name = item["name"] as? String ?: run {
            Log.w(TAG, "InAppBrowser: toCookiePair — skipping item with missing 'name': $item")
            return null
        }
        val value = item["value"] as? String ?: run {
            Log.w(TAG, "InAppBrowser: toCookiePair — skipping cookie '$name' with missing 'value'")
            return null
        }
        val domain = item["domain"] as? String ?: run {
            Log.w(TAG, "InAppBrowser: toCookiePair — skipping cookie '$name' with missing 'domain'")
            return null
        }
        if (name.isBlank() || domain.isBlank()) {
            Log.w(TAG, "InAppBrowser: toCookiePair — skipping cookie with blank name or domain: name='$name' domain='$domain'")
            return null
        }

        val path = (item["path"] as? String)?.takeIf { it.isNotBlank() } ?: "/"
        val secure = readBoolean(item["secure"]) || readBoolean(item["isSecure"])
        val httpOnly = readBoolean(item["httpOnly"]) || readBoolean(item["isHttpOnly"])
        val sameSite = (item["sameSite"] as? String)?.trim()?.takeIf { it.isNotEmpty() }

        val cookieUrl = "https://${domain.trimStart('.')}"
        val cookieValue = buildString {
            append("$name=$value")
            append("; Domain=$domain")
            append("; Path=$path")
            if (secure) append("; Secure")
            if (httpOnly) append("; HttpOnly")
            if (!sameSite.isNullOrEmpty()) append("; SameSite=$sameSite")
        }


        return cookieUrl to cookieValue
    }

    private fun readBoolean(value: Any?): Boolean {
        return when (value) {
            is Boolean -> value
            is Number -> value.toInt() != 0
            is String -> value.equals("true", ignoreCase = true) || value == "1"
            else -> false
        }
    }

    private fun autoClickLink(webView: WebView?, targetUrl: String) {
        if (webView == null) return

        val escaped = targetUrl
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\n", "\\n")
            .replace("\r", "\\r")

        val script = """
            (function() {
                var target = '$escaped';
                function dec(v) { try { return decodeURIComponent(v||''); } catch(e) { return v; } }
                var decoded = dec(target);
                var links = document.querySelectorAll('a[href]');
                for (var i = 0; i < links.length; i++) {
                    var h = links[i].getAttribute('href') || '';
                    if (h === target || dec(h) === decoded) { links[i].click(); return; }
                }
            })();
        """.trimIndent()

        webView.evaluateJavascript(script, null)
    }

    // endregion

    // region Filename Helpers

    private fun resolveFilename(contentDisposition: String?, urlString: String, preferred: String?): String {
        if (!preferred.isNullOrBlank()) return normalizeFilename(preferred)

        if (!contentDisposition.isNullOrBlank()) {
            parseFilenameFromDisposition(contentDisposition)?.let { return normalizeFilename(it) }
        }

        Uri.parse(urlString).lastPathSegment?.takeIf { it.isNotBlank() }?.let {
            return normalizeFilename(try { URLDecoder.decode(it, "UTF-8") } catch (_: Exception) { it })
        }

        return "attachment.bin"
    }

    private fun parseFilenameFromDisposition(header: String): String? {
        for (part in header.split(";")) {
            val trimmed = part.trim()
            if (trimmed.lowercase().startsWith("filename*=")) {
                val value = trimmed.substringAfter("=").replace(Regex("(?i)UTF-8''"), "")
                return try { URLDecoder.decode(value, "UTF-8") } catch (_: Exception) { value }
            }
            if (trimmed.lowercase().startsWith("filename=")) {
                return trimmed.substringAfter("=").trim('"')
            }
        }
        return null
    }

    private fun normalizeFilename(filename: String?): String {
        if (filename.isNullOrBlank()) return "attachment.bin"

        val decoded = try { URLDecoder.decode(filename, "UTF-8") } catch (_: Exception) { filename }
        return decoded.trim()
            .replace("/", "_")
            .replace("\\", "_")
            .replace(":", "_")
            .ifEmpty { "attachment.bin" }
    }

    private fun shouldUseNativePhpBridge(urlString: String): Boolean {
        val uri = Uri.parse(urlString)
        val scheme = uri.scheme?.lowercase()
        val host = uri.host?.lowercase()

        return when {
            scheme.isNullOrEmpty() -> true
            scheme !in listOf("http", "https") -> false
            host.isNullOrEmpty() -> true
            host == "127.0.0.1" || host == "localhost" -> true
            else -> false
        }
    }

    private fun toLocalPhpUri(urlString: String): Uri {
        val uri = Uri.parse(urlString)
        val scheme = uri.scheme?.lowercase()

        return when {
            scheme.isNullOrEmpty() -> {
                val normalized = if (urlString.startsWith("/")) urlString else "/$urlString"
                Uri.parse("http://127.0.0.1$normalized")
            }
            uri.host.equals("127.0.0.1", ignoreCase = true) || uri.host.equals("localhost", ignoreCase = true) -> {
                uri
            }
            else -> {
                uri
            }
        }
    }

    private fun getHeaderIgnoreCase(headers: Map<String, String>, key: String): String? {
        return headers.entries.firstOrNull { it.key.equals(key, ignoreCase = true) }?.value
    }

    // endregion

    private fun showError(activity: FragmentActivity, message: String) {
        mainHandler.post {
            AlertDialog.Builder(activity)
                .setTitle("下載失敗")
                .setMessage(message)
                .setPositiveButton("確定", null)
                .show()
        }
    }
}
