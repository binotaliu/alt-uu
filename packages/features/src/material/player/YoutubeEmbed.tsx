import { useImperativeHandle, useRef, type Ref } from 'react';
import { View } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import {
    TypedWebView,
    type WebViewHandle,
} from '../../courses/browser/TypedWebView';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

export interface YoutubeEmbedHandle {
    getCurrentTime(): number;
    getDuration(): number;
    seekTo(seconds: number): void;
}

export interface YoutubeEmbedProps {
    /** The statics `youtube-embed?v=` wrapper page. */
    embedUrl: string;
    title: string;
    onProgress?: (currentTime: number, duration: number) => void;
    /** Top-level navigations away from the wrapper (e.g. the YouTube logo). */
    onExternalLink: (url: string) => void;
    ref?: Ref<YoutubeEmbedHandle>;
}

/**
 * Forwards the wrapper page's `altuu-youtube-embed` messages (it posts them
 * to `window.parent`, which is itself when loaded top-level) to React Native.
 */
const BRIDGE_SCRIPT = `(function () {
    window.addEventListener('message', function (event) {
        var data = event.data;
        if (data && data.source === 'altuu-youtube-embed' && window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(data));
        }
    });
})();
true;`;

function originOf(url: string): string | null {
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
}

/**
 * YouTube materials: the statics wrapper page in a WebView (a real https
 * document, so YouTube gets the Referer it requires), played inline without
 * jumping to the YouTube app. Position / duration feed the study timer and
 * the resume prompt seeks through the wrapper's `altuu-app` channel.
 */
export function YoutubeEmbed({
    embedUrl,
    title,
    onProgress,
    onExternalLink,
    ref,
}: YoutubeEmbedProps) {
    const webViewRef = useRef<WebViewHandle>(null);
    const stateRef = useRef({ currentTime: 0, duration: 0 });
    const embedOrigin = originOf(embedUrl);

    useImperativeHandle(
        ref,
        () => ({
            getCurrentTime: () => stateRef.current.currentTime,
            getDuration: () => stateRef.current.duration,
            seekTo: (seconds: number) => {
                const time = Number.isFinite(seconds) ? seconds : 0;

                webViewRef.current?.injectJavaScript(
                    `window.postMessage({ source: 'altuu-app', type: 'seek', time: ${time} }, '*'); true;`,
                );
            },
        }),
        [],
    );

    const handleMessage = (event: WebViewMessageEvent) => {
        let data: { currentTime?: unknown; duration?: unknown };

        try {
            data = JSON.parse(event.nativeEvent.data);
        } catch {
            return;
        }

        if (
            typeof data.currentTime === 'number' &&
            Number.isFinite(data.currentTime)
        ) {
            stateRef.current.currentTime = data.currentTime;
        }

        if (
            typeof data.duration === 'number' &&
            Number.isFinite(data.duration) &&
            data.duration > 0
        ) {
            stateRef.current.duration = data.duration;
        }

        onProgress?.(stateRef.current.currentTime, stateRef.current.duration);
    };

    const handleShouldStartLoad = (request: ShouldStartLoadRequest) => {
        if (
            request.isTopFrame === false ||
            request.url === 'about:blank' ||
            (embedOrigin !== null && originOf(request.url) === embedOrigin)
        ) {
            return true;
        }

        onExternalLink(request.url);

        return false;
    };

    return (
        <View className="aspect-video w-full overflow-hidden rounded-2xl border border-theme-200 bg-black dark:border-zinc-700">
            <TypedWebView
                ref={webViewRef}
                source={{ uri: embedUrl }}
                accessibilityLabel={title}
                style={{ backgroundColor: '#000' }}
                injectedJavaScriptBeforeContentLoaded={BRIDGE_SCRIPT}
                onMessage={handleMessage}
                onShouldStartLoadWithRequest={handleShouldStartLoad}
                allowsInlineMediaPlayback
                allowsFullscreenVideo
                allowsPictureInPictureMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                setSupportMultipleWindows={false}
                javaScriptEnabled
                scrollEnabled={false}
            />
        </View>
    );
}
