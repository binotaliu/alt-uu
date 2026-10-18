import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { TypedWebView, type WebViewHandle } from '../shell/TypedWebView';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import {
  FONT_SCALE_DEFAULT,
  MATERIAL_HTML_BRIDGE_SCRIPT,
  buildMaterialHtmlDocument,
  fontScaleScript,
  parseMaterialHtmlMessage,
  type MaterialHtmlPalette,
} from './materialHtmlDocument';

export interface MaterialHtmlViewProps {
  html: string;
  /** Page URL of the material; relative URLs resolve against it. */
  baseUrl: string;
  fontScale: number;
  isDark: boolean;
  palette: MaterialHtmlPalette;
  onLinkPress: (href: string) => void;
  onImagePress: (src: string, alt: string) => void;
}

const MIN_HEIGHT = 80;

function isInitialDocument(url: string, baseUrl: string): boolean {
  return (
    url === baseUrl ||
    url === 'about:blank' ||
    url.startsWith('data:') ||
    url.split('#')[0] === baseUrl.split('#')[0]
  );
}

/**
 * Material HTML in an auto-height WebView (legacy `v-html` article). The
 * page is loaded with the material URL as `baseUrl`, so same-host images
 * load upstream with the HUNGU cookies the parent seeded beforehand. Link
 * and image taps come back as callbacks; the WebView never navigates away.
 */
export function MaterialHtmlView({
  html,
  baseUrl,
  fontScale,
  isDark,
  palette,
  onLinkPress,
  onImagePress,
}: MaterialHtmlViewProps) {
  const webViewRef = useRef<WebViewHandle>(null);
  const [height, setHeight] = useState(MIN_HEIGHT);

  // The document is rebuilt only for new content or colours. The font
  // scale is applied by script (at load, and in place on change) so a
  // size change does not reload the page.
  const document = useMemo(
    () =>
      buildMaterialHtmlDocument({
        html,
        isDark,
        palette,
        fontScale: FONT_SCALE_DEFAULT,
      }),
    [html, isDark, palette],
  );

  useEffect(() => {
    webViewRef.current?.injectJavaScript(fontScaleScript(fontScale));
  }, [fontScale]);

  const handleMessage = (event: WebViewMessageEvent) => {
    const message = parseMaterialHtmlMessage(event.nativeEvent.data);

    if (message === null) {
      return;
    }

    if (message.type === 'height') {
      setHeight(Math.max(MIN_HEIGHT, message.height));
    } else if (message.type === 'link') {
      onLinkPress(message.href);
    } else {
      onImagePress(message.src, message.alt);
    }
  };

  const handleShouldStartLoad = (request: ShouldStartLoadRequest) => {
    if (
      request.isTopFrame === false ||
      isInitialDocument(request.url, baseUrl)
    ) {
      return true;
    }

    onLinkPress(request.url);

    return false;
  };

  return (
    <View style={{ height }} testID="material-html">
      <TypedWebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: document, baseUrl }}
        injectedJavaScript={`${fontScaleScript(fontScale)}\n${MATERIAL_HTML_BRIDGE_SCRIPT}`}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        scrollEnabled={false}
        nestedScrollEnabled={false}
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        javaScriptEnabled
        style={{ backgroundColor: 'transparent' }}
        containerStyle={{ backgroundColor: 'transparent' }}
      />
    </View>
  );
}
