<?php

use Illuminate\Support\Facades\File;

it('routes local attachment downloads through php bridge on android', function () {
    $source = File::get(base_path('packages/altuu/plugin-attachment-bridge/resources/android/src/AttachmentBridgeFunctions.kt'));

    expect($source)
        ->toContain('shouldUseNativePhpBridge')
        ->toContain('fetchAndPresentViaPhpBridge')
        ->toContain('resolvePhpBridgeFromActivity')
        ->toContain('handleLaravelRequest(phpRequest)');
});

it('applies system bar insets to attachment in-app browser dialog root', function () {
    $source = File::get(base_path('packages/altuu/plugin-attachment-bridge/resources/android/src/AttachmentBridgeFunctions.kt'));

    expect($source)
        ->toContain('setOnApplyWindowInsetsListener(root)')
        ->toContain('WindowInsetsCompat.Type.systemBars()')
        ->toContain('requestApplyInsets(root)');
});

it('injects cookies before android in-app browser requests', function () {
    $source = File::get(base_path('packages/altuu/plugin-attachment-bridge/resources/android/src/AttachmentBridgeFunctions.kt'));

    expect($source)
        ->toContain('setAcceptThirdPartyCookies(webView, true)')
        ->toContain('injectCookiesAndLoad(webView, urlString, cookiesPayload, postForm)')
        ->toContain('cookieManager.setCookie(cookieUrl, cookieValue) {')
        ->toContain('cookieManager.flush()')
        ->toContain('loadBrowserRequest(webView, urlString, postForm, cookiesPayload)');
});

it('normalizes bridge json parameters for android browser cookies and post form', function () {
    $source = File::get(base_path('packages/altuu/plugin-attachment-bridge/resources/android/src/AttachmentBridgeFunctions.kt'));

    expect($source)
        ->toContain('private fun normalizeBridgeValue(value: Any?): Any?')
        ->toContain('is JSONObject -> {')
        ->toContain('is JSONArray -> {')
        ->toContain('private fun getObjectParameter(parameters: Map<String, Any>, key: String): Map<String, Any>?')
        ->toContain('private fun getObjectListParameter(parameters: Map<String, Any>, key: String): List<Map<String, Any>>')
        ->toContain('val cookies = getObjectListParameter(parameters, "cookies")')
        ->toContain('getObjectParameter(parameters, "postForm")');
});

it('does not call WebView.settings from shouldInterceptRequest because it may be off main thread', function () {
    $source = File::get(base_path('packages/altuu/plugin-attachment-bridge/resources/android/src/AttachmentBridgeFunctions.kt'));

    expect($source)
        ->not->toContain('view?.settings?.userAgentString')
        ->toContain('val webViewUserAgent = webView.settings.userAgentString');
});
