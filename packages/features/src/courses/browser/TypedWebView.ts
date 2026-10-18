import type { ComponentType, Ref } from 'react';
import { WebView, type WebViewProps } from 'react-native-webview';

/** Instance type of the WebView (for refs: `goBack`, `injectJavaScript`, ...). */
export type WebViewHandle = WebView;

/**
 * react-native-webview declares `class WebView<P = undefined>` with props
 * `WebViewProps & P`, which collapses to `never` under strict null checks.
 * This is the same component with its real props type.
 */
export const TypedWebView = WebView as unknown as ComponentType<
    WebViewProps & { ref?: Ref<WebViewHandle> }
>;
