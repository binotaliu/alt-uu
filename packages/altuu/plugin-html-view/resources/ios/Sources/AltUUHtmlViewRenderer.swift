import SwiftUI
import UIKit
@preconcurrency import WebKit

/// `<native:html-view>` (wire type `html_view`): sandboxed WKWebView for
/// foreign, already-sanitised HTML. Modelled on the stock
/// `NativeUIWebviewRenderer` (same lockdown posture) and adds:
///
/// - **Auto height** (`auto_height`): the content height is measured by a
///   script that runs in the isolated `WKContentWorld.defaultClient` (so it
///   also works while page JavaScript is off) and adopted natively with
///   `.frame(height:)`. PHP is only told about it through `on_height_change`
///   (informational; sizing never waits on PHP).
/// - **Link interception** (`on_link_tap`): a tapped link, a `target=_blank`
///   link or `window.open()` is cancelled BEFORE navigation and reported as
///   JSON `{"url","scheme","newWindow"}`. Without a callback the tap is just
///   swallowed. mailto:/tel:/http(s) are all reported, none opened here.
/// - **Message bridge** (`on_message`, needs `javascript`): page scripts call
///   `window.AltUUBridge.postMessage(objectOrString)`; PHP receives the JSON
///   string. `user_script` is injected at document start in the page world
///   (after the bridge shim) so a host can forward e.g. `window.postMessage`
///   traffic.
/// - **Appearance** (`color_scheme` light|dark, default follows the device)
///   and **font scale** (`font_scale`, applied as `-webkit-text-size-adjust`).
///
/// Posture (unchanged from the stock renderer): non-persistent data store
/// (no cookies), JS off unless `javascript`, no DOM storage unless
/// `dom_storage`, no link previews, no back/forward swipe, autoplay blocked,
/// transparent background, inline HTML loaded with an opaque origin unless
/// `base_url` is given.
///
/// NOTE: written without being compiled (no Xcode available when authored);
/// see the verification list in docs/native-migration/conventions.md 11.5.
struct AltUUHtmlViewRenderer: View {
    let node: NativeUINode

    @State private var contentHeight: CGFloat = 0

    var body: some View {
        let autoHeight = node.props.getBool("auto_height", default: false)
        let estimated = CGFloat(node.props.getFloat("estimated_height", default: 80))
        let resolvedHeight: CGFloat? = autoHeight ? (contentHeight > 0 ? contentHeight : estimated) : nil

        AltUUHtmlWebView(node: node, contentHeight: $contentHeight)
            // The configuration (script handlers, JS, storage, user script)
            // is fixed when the WKWebView is created, so a change to any of
            // it has to rebuild the view.
            .id(configurationSignature())
            .frame(height: resolvedHeight)
    }

    private func configurationSignature() -> String {
        let js = node.props.getBool("javascript", default: false)
        let storage = node.props.getBool("dom_storage", default: false)
        let script = node.props.getString("user_script")
        let messages = node.props.getCallbackId("on_message") != 0
        let auto = node.props.getBool("auto_height", default: false)
        return "\(js)|\(storage)|\(messages)|\(auto)|\(script)"
    }
}

private struct AltUUHtmlWebView: UIViewRepresentable {
    let node: NativeUINode
    @Binding var contentHeight: CGFloat

    private static let messageHandlerName = "altuuMessage"
    private static let heightHandlerName = "altuuHeight"

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        let controller = uiView.configuration.userContentController
        controller.removeScriptMessageHandler(forName: messageHandlerName, contentWorld: .page)
        controller.removeScriptMessageHandler(forName: heightHandlerName, contentWorld: .defaultClient)
        controller.removeAllUserScripts()
        uiView.stopLoading()
    }

    func makeUIView(context: Context) -> WKWebView {
        let coordinator = context.coordinator
        let javascript = node.props.getBool("javascript", default: false)
        let autoHeight = node.props.getBool("auto_height", default: false)

        let config = WKWebViewConfiguration()

        // Non-persistent: no cookies / cache survive the view.
        config.websiteDataStore = .nonPersistent()
        config.mediaTypesRequiringUserActionForPlayback = .all
        config.allowsInlineMediaPlayback = true

        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = javascript
        config.defaultWebpagePreferences = prefs

        let controller = config.userContentController
        let handler = ScriptHandler(coordinator: coordinator)

        // Height/font scripts live in the isolated client world so they keep
        // working with page JavaScript off and can't be reached by the page.
        controller.add(handler, contentWorld: .defaultClient, name: Self.heightHandlerName)
        controller.addUserScript(WKUserScript(
            source: Self.isolatedScript,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true,
            in: .defaultClient
        ))

        if javascript {
            controller.add(handler, contentWorld: .page, name: Self.messageHandlerName)
            let userScript = node.props.getString("user_script")
            controller.addUserScript(WKUserScript(
                source: Self.bridgeShim + "\n" + userScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true,
                in: .page
            ))
        }

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = coordinator
        webView.uiDelegate = coordinator
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.underPageBackgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.isScrollEnabled = !autoHeight
        webView.scrollView.bounces = !autoHeight

        coordinator.webView = webView
        sync(coordinator, webView)
        coordinator.applyFontScale(node.props.getFloat("font_scale", default: 1))
        load(into: webView, coordinator: coordinator)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let coordinator = context.coordinator
        sync(coordinator, webView)

        let signature = contentSignature()
        if coordinator.contentSignature != signature {
            load(into: webView, coordinator: coordinator)
        }

        coordinator.applyFontScale(node.props.getFloat("font_scale", default: 1))
    }

    /// Copies everything that only affects dispatch (callback ids, node id,
    /// appearance) onto the long-lived coordinator / web view. None of it
    /// takes part in the content signature, so it can never trigger a reload.
    private func sync(_ coordinator: Coordinator, _ webView: WKWebView) {
        coordinator.nodeId = node.id
        coordinator.linkTapCallbackId = node.props.getCallbackId("on_link_tap")
        coordinator.heightCallbackId = node.props.getCallbackId("on_height_change")
        coordinator.messageCallbackId = node.props.getCallbackId("on_message")
        coordinator.usesSrc = node.props.getString("html").isEmpty
        coordinator.heightBinding = $contentHeight

        switch node.props.getString("color_scheme") {
        case "dark": webView.overrideUserInterfaceStyle = .dark
        case "light": webView.overrideUserInterfaceStyle = .light
        default: webView.overrideUserInterfaceStyle = .unspecified
        }
    }

    private func contentSignature() -> String {
        node.props.getString("src") + "\u{1F}" + node.props.getString("html") + "\u{1F}" + node.props.getString("base_url")
    }

    private func load(into webView: WKWebView, coordinator: Coordinator) {
        coordinator.contentSignature = contentSignature()
        coordinator.lastReportedHeight = 0

        let html = node.props.getString("html")
        let src = node.props.getString("src")
        let baseURL = URL(string: node.props.getString("base_url"))

        if !html.isEmpty {
            coordinator.expectProgrammaticLoad()
            // baseURL nil = opaque origin (cannot touch the host app).
            webView.loadHTMLString(html, baseURL: baseURL.flatMap { isLoadableScheme($0.scheme) ? $0 : nil })
            return
        }

        guard !src.isEmpty, let url = URL(string: src), isLoadableScheme(url.scheme) else { return }
        coordinator.expectProgrammaticLoad()
        webView.load(URLRequest(url: url))
    }

    // MARK: Scripts

    /// Runs in `.defaultClient`. Reports the body's border-box height (NOT
    /// `documentElement.scrollHeight`, which never drops below the viewport
    /// and would feed the frame we just set back into itself).
    private static let isolatedScript = """
    (function () {
      var handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.\(heightHandlerName);
      if (!handler) { return; }
      var last = -1;
      function measure() {
        var body = document.body;
        if (!body) { return; }
        var style = window.getComputedStyle(body);
        var height = Math.ceil(body.getBoundingClientRect().height
          + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0));
        if (height !== last) { last = height; handler.postMessage(height); }
      }
      window.__altuuMeasure = measure;
      if (window.ResizeObserver && document.body) { new ResizeObserver(measure).observe(document.body); }
      document.addEventListener('load', measure, true);
      window.addEventListener('load', measure);
      window.addEventListener('resize', measure);
      if (document.fonts && document.fonts.ready) { document.fonts.ready.then(measure); }
      measure();
    })();
    """

    /// Page world. `AltUUBridge.postMessage` is the single entry the page
    /// (and `user_script`) uses; `AndroidBridge` is the Android spelling of
    /// the same channel, kept here so one script runs on both platforms.
    private static let bridgeShim = """
    (function () {
      if (window.AltUUBridge) { return; }
      window.AltUUBridge = {
        postMessage: function (payload) {
          var text = typeof payload === 'string' ? payload : JSON.stringify(payload);
          var native = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.\(messageHandlerName);
          if (native) { native.postMessage(text); }
          else if (window.AndroidBridge) { window.AndroidBridge.postMessage(text); }
        }
      };
    })();
    """

    // MARK: Script message plumbing

    /// WKUserContentController retains its handlers strongly; this thin,
    /// weakly-linked forwarder keeps the coordinator (and through it the
    /// SwiftUI state binding) from being retained by the web view.
    private final class ScriptHandler: NSObject, WKScriptMessageHandler {
        weak var coordinator: Coordinator?

        init(coordinator: Coordinator) {
            self.coordinator = coordinator
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            switch message.name {
            case AltUUHtmlWebView.heightHandlerName:
                if let number = message.body as? NSNumber {
                    coordinator?.handleHeight(CGFloat(truncating: number))
                }
            case AltUUHtmlWebView.messageHandlerName:
                coordinator?.handleMessage(message.body)
            default:
                break
            }
        }
    }

    // MARK: Coordinator

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var nodeId: Int = 0
        var linkTapCallbackId: Int = 0
        var heightCallbackId: Int = 0
        var messageCallbackId: Int = 0
        var usesSrc: Bool = false
        var contentSignature: String = ""
        var lastReportedHeight: CGFloat = 0
        var heightBinding: Binding<CGFloat>?
        weak var webView: WKWebView?

        private var awaitingProgrammaticLoad = false
        private var fontScale: Float = 1

        /// The next main-frame `.other` navigation belongs to our own
        /// load/loadHTMLString call and must be allowed through.
        func expectProgrammaticLoad() {
            awaitingProgrammaticLoad = true
        }

        // MARK: Height / messages / font scale

        func handleHeight(_ height: CGFloat) {
            guard height.isFinite, height >= 0 else { return }

            if let binding = heightBinding, abs(binding.wrappedValue - height) >= 0.5 {
                binding.wrappedValue = height
            }

            // Informational PHP event: every event costs a full PHP render
            // and tree publish, so ignore sub-2pt jitter.
            guard heightCallbackId != 0, abs(lastReportedHeight - height) >= 2 else { return }
            lastReportedHeight = height
            NativeElementBridge.sendTextChangeEvent(heightCallbackId, nodeId: nodeId, text: String(format: "%.1f", Double(height)))
        }

        func handleMessage(_ body: Any) {
            guard messageCallbackId != 0 else { return }

            let text: String
            if let string = body as? String {
                text = string
            } else if JSONSerialization.isValidJSONObject(body),
                      let data = try? JSONSerialization.data(withJSONObject: body),
                      let string = String(data: data, encoding: .utf8) {
                text = string
            } else {
                return
            }

            // Hard cap so a runaway page cannot flood the PHP event queue.
            guard text.utf8.count <= 262_144 else { return }
            NativeElementBridge.sendTextChangeEvent(messageCallbackId, nodeId: nodeId, text: text)
        }

        func applyFontScale(_ scale: Float) {
            guard scale != fontScale else { return }
            fontScale = scale
            evaluateFontScale()
        }

        /// Re-applied after every load: the script above cannot touch a body
        /// that does not exist yet when the scale is first set.
        private func evaluateFontScale() {
            let percent = Int((max(0.5, min(3.0, fontScale)) * 100).rounded())
            let js = "(function(){var v='\(percent)%';document.documentElement.style.setProperty('-webkit-text-size-adjust',v);if(document.body){document.body.style.setProperty('-webkit-text-size-adjust',v);}if(window.__altuuMeasure){window.__altuuMeasure();}})();"
            webView?.evaluateJavaScript(js, in: nil, in: .defaultClient, completionHandler: nil)
        }

        // MARK: WKNavigationDelegate

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            // Sub-frame loads (iframes, images, media) are not gated.
            let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? false
            let opensNewWindow = navigationAction.targetFrame == nil
            if !isMainFrame && !opensNewWindow {
                decisionHandler(.allow)
                return
            }

            // Our own loadHTMLString / load(_:) call.
            if isMainFrame, navigationAction.navigationType == .other, awaitingProgrammaticLoad {
                awaitingProgrammaticLoad = false
                decisionHandler(.allow)
                return
            }

            // Reloads (content-process recovery) and redirects/JS navigations
            // of a `src` page (e.g. a hosted YouTube wrapper) stay in place.
            if isMainFrame, isLoadableScheme(url.scheme),
               navigationAction.navigationType == .reload
                || (usesSrc && navigationAction.navigationType == .other) {
                decisionHandler(.allow)
                return
            }

            // Everything else at the top level is a user-visible navigation:
            // taps, target=_blank, form posts, scripted redirects of inline
            // HTML. Cancel it and let PHP decide.
            decisionHandler(.cancel)
            reportLinkTap(url: url, newWindow: opensNewWindow)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            if fontScale != 1 {
                evaluateFontScale()
            }
            // Belt and braces next to the observer script.
            webView.evaluateJavaScript("window.__altuuMeasure && window.__altuuMeasure();", in: nil, in: .defaultClient, completionHandler: nil)
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            awaitingProgrammaticLoad = false
            webView.reload()
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            print("[AltUUHtmlView] provisional load failed: \(error)")
        }

        // MARK: WKUIDelegate

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            // window.open() / target=_blank: never open a window, report it.
            if let url = navigationAction.request.url {
                reportLinkTap(url: url, newWindow: true)
            }
            return nil
        }

        private func reportLinkTap(url: URL, newWindow: Bool) {
            guard linkTapCallbackId != 0 else { return }

            let payload: [String: Any] = [
                "url": url.absoluteString,
                "scheme": (url.scheme ?? "").lowercased(),
                "newWindow": newWindow,
            ]

            guard let data = try? JSONSerialization.data(withJSONObject: payload),
                  let text = String(data: data, encoding: .utf8) else { return }

            NativeElementBridge.sendTextChangeEvent(linkTapCallbackId, nodeId: nodeId, text: text)
        }
    }
}

private func isLoadableScheme(_ scheme: String?) -> Bool {
    guard let scheme = scheme?.lowercased() else { return false }
    return scheme == "https" || scheme == "http" || scheme == "data" || scheme == "about"
}
