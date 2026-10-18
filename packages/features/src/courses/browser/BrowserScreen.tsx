import { setWebViewCookies } from '@altuu/attachment-bridge';
import {
  Button,
  PageHeader,
  Screen,
  Text,
  Icon,
  type IconName,
} from '@altuu/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  Share,
  View,
} from 'react-native';
import type {
  FileDownloadEvent,
  WebViewErrorEvent,
  ShouldStartLoadRequest,
  WebViewNavigation,
  WebViewOpenWindowEvent,
  WebViewProgressEvent,
} from 'react-native-webview/lib/WebViewTypes';

import { useAppServices } from '../../services/AppServicesProvider';
import { NoViewerSheet } from '../attachments/NoViewerSheet';
import { useAttachmentDownload } from '../attachments/useAttachmentDownload';
import {
  encodeFormBody,
  parseBrowserParams,
  type BrowserRequest,
} from './browserParams';
import { buildBeforeContentLoadedScript } from './browserScripts';
import { TypedWebView, type WebViewHandle } from '../../shell/TypedWebView';
import {
  loadDownloadCookies,
  loadHunguBrowserSession,
  type BrowserSession,
} from './browserSession';
import { hostOf } from '../../shell/url';

const DEFAULT_TITLE = 'App 內瀏覽器';

/** Schemes the WebView renders itself; everything else goes to the system. */
const WEB_SCHEME = /^(https?|about|blob|data):/i;

/** Android has no download hook in react-native-webview, so spot file links. */
const DOWNLOAD_EXTENSION =
  /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|csv|txt|odt|ods|odp)(?:$|[?#])/i;

export function isDownloadUrl(url: string): boolean {
  const path = url.split(/[?#]/)[0] ?? '';

  return DOWNLOAD_EXTENSION.test(url) || DOWNLOAD_EXTENSION.test(path);
}

function fileNameFromUrl(url: string): string | undefined {
  const path = url.split(/[?#]/)[0] ?? '';
  const last = path.split('/').pop() ?? '';

  try {
    return decodeURIComponent(last) || undefined;
  } catch {
    return last || undefined;
  }
}

function HeaderButton({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      className={`p-1.5 ${disabled ? 'opacity-30' : ''}`}
    >
      <Icon
        name={icon}
        size={22}
        className="text-theme-700 dark:text-zinc-300"
      />
    </Pressable>
  );
}

export interface BrowserViewProps {
  request: BrowserRequest;
}

/** The in-app browser for an already validated request. */
export function BrowserView({ request }: BrowserViewProps) {
  const services = useAppServices();
  const webViewRef = useRef<WebViewHandle>(null);
  const [session, setSession] = useState<BrowserSession | null>(null);
  const [navigation, setNavigation] = useState<WebViewNavigation | null>(null);
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const attachment = useAttachmentDownload();

  // Seed the HUNGU session into the platform cookie store before loading.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const hungu = await loadHunguBrowserSession(services);

      if (hungu.baseUrl !== null && hungu.cookies.length > 0) {
        try {
          await setWebViewCookies(hungu.baseUrl, hungu.cookies);
        } catch {
          // The page loads without the session cookies.
        }
      }

      if (!cancelled) {
        setSession(hungu);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [services]);

  const source = useMemo(
    () =>
      request.method === 'POST'
        ? {
            uri: request.url,
            method: 'POST',
            headers: {
              'Content-Type':
                'application/x-www-form-urlencoded; charset=utf-8',
            },
            body: encodeFormBody(request.postForm),
          }
        : { uri: request.url },
    [request],
  );
  const injectedScript = useMemo(
    () => buildBeforeContentLoadedScript(request.cssPreset),
    [request.cssPreset],
  );

  const currentUrl = navigation?.url || request.url;
  const canGoBack = navigation?.canGoBack ?? false;

  const close = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/courses');
    }
  }, []);

  // Android back button walks the page history before leaving the screen.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (canGoBack) {
          webViewRef.current?.goBack();

          return true;
        }

        return false;
      },
    );

    return () => subscription.remove();
  }, [canGoBack]);

  const startDownload = useCallback(
    async (url: string) => {
      const cookies = await loadDownloadCookies(
        services,
        session ?? { baseUrl: null, cookies: [] },
        url,
      );

      await attachment.start({
        source: 'direct',
        url,
        fileName: fileNameFromUrl(url),
        headers: { Referer: currentUrl },
        cookies,
      });
    },
    [attachment, currentUrl, services, session],
  );

  const handleShouldStart = (event: ShouldStartLoadRequest): boolean => {
    const { url } = event;

    if (!WEB_SCHEME.test(url)) {
      // tronclass:// and other app links (mailto:, tel:, ...).
      if (event.isTopFrame !== false) {
        void Linking.openURL(url).catch(() => undefined);
      }

      return false;
    }

    if (
      Platform.OS === 'android' &&
      event.isTopFrame !== false &&
      event.navigationType === 'click' &&
      isDownloadUrl(url)
    ) {
      void startDownload(url);

      return false;
    }

    return true;
  };

  const openInSameView = (event: WebViewOpenWindowEvent) => {
    const target = event.nativeEvent.targetUrl;

    if (!WEB_SCHEME.test(target)) {
      void Linking.openURL(target).catch(() => undefined);

      return;
    }

    webViewRef.current?.injectJavaScript(
      `window.location.href = ${JSON.stringify(target)}; true;`,
    );
  };

  const share = () => {
    void Share.share(
      Platform.OS === 'ios' ? { url: currentUrl } : { message: currentUrl },
    ).catch(() => undefined);
  };

  const downloading = attachment.state.status === 'downloading';

  return (
    <Screen ignoreTopInset ignoreBottomInset>
      <PageHeader
        title={navigation?.title?.trim() || DEFAULT_TITLE}
        subtitle={hostOf(currentUrl) || null}
        showBack={false}
        left={<HeaderButton label="完成" icon="x-mark" onPress={close} />}
        right={
          <>
            <HeaderButton
              label="上一頁"
              icon="arrow-left"
              disabled={!canGoBack}
              onPress={() => webViewRef.current?.goBack()}
            />
            <HeaderButton
              label="下一頁"
              icon="arrow-right"
              disabled={!navigation?.canGoForward}
              onPress={() => webViewRef.current?.goForward()}
            />
            <HeaderButton label="分享網址" icon="share" onPress={share} />
          </>
        }
      />

      {progress > 0 && progress < 1 ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(progress * 100),
          }}
          className="h-0.5 bg-transparent"
        >
          <View
            className="h-0.5 bg-blue-500"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </View>
      ) : (
        <View className="h-0.5" />
      )}

      <View className="flex-1">
        {session === null ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : (
          <TypedWebView
            key={reloadKey}
            ref={webViewRef}
            source={source}
            originWhitelist={['*']}
            injectedJavaScriptBeforeContentLoaded={injectedScript}
            onLoadProgress={(event: WebViewProgressEvent) =>
              setProgress(event.nativeEvent.progress)
            }
            onLoadStart={() => setLoadError(null)}
            onNavigationStateChange={setNavigation}
            onShouldStartLoadWithRequest={handleShouldStart}
            onOpenWindow={openInSameView}
            setSupportMultipleWindows={false}
            onFileDownload={(event: FileDownloadEvent) =>
              void startDownload(event.nativeEvent.downloadUrl)
            }
            onError={(event: WebViewErrorEvent) =>
              setLoadError(event.nativeEvent.description || '載入失敗')
            }
            allowsBackForwardNavigationGestures
            startInLoadingState={false}
          />
        )}

        {loadError ? (
          <View className="absolute inset-0 items-center justify-center gap-4 bg-white p-6 dark:bg-zinc-900">
            <Text className="text-lg font-semibold">載入失敗</Text>
            <Text className="text-center text-sm text-theme-700 dark:text-zinc-300">
              {loadError}
            </Text>
            <View className="flex-row gap-3">
              <Button label="關閉" variant="secondary" onPress={close} />
              <Button
                label="重新載入"
                onPress={() => {
                  setLoadError(null);
                  setReloadKey((key) => key + 1);
                }}
              />
            </View>
          </View>
        ) : null}

        {downloading || attachment.state.status === 'error' ? (
          <View className="absolute inset-x-3 bottom-4 flex-row items-center gap-3 rounded-xl border border-theme-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800">
            {downloading ? <ActivityIndicator /> : null}
            <Text className="min-w-0 flex-1 text-sm">
              {attachment.state.status === 'error'
                ? attachment.state.message
                : attachment.state.status === 'downloading' &&
                    attachment.state.progress !== null
                  ? `下載中 ${Math.round(attachment.state.progress * 100)}%`
                  : '下載中...'}
            </Text>
            {attachment.state.status === 'error' ? (
              <Pressable
                accessibilityRole="button"
                onPress={attachment.dismiss}
              >
                <Text className="text-sm font-semibold text-theme-700 dark:text-zinc-300">
                  關閉
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <NoViewerSheet
        visible={attachment.state.status === 'noViewer'}
        onSave={() => void attachment.saveFile()}
        onDismiss={attachment.dismiss}
      />
    </Screen>
  );
}

/** Route screen for `/browser` (`url`, optional `method`, `postForm`, `css`). */
export function BrowserScreen() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const parsed = parseBrowserParams(params);

  if (!parsed.ok) {
    return (
      <Screen ignoreTopInset ignoreBottomInset>
        <PageHeader title={DEFAULT_TITLE} />
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="text-center text-theme-700 dark:text-zinc-300">
            {parsed.reason}
          </Text>
          <Button
            label="返回"
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>
      </Screen>
    );
  }

  return (
    <BrowserView
      key={`${parsed.request.method}:${parsed.request.url}`}
      request={parsed.request}
    />
  );
}
