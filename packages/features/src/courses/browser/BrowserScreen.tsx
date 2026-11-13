import {
  download,
  printFile,
  saveFile,
  setWebViewCookies,
  type DownloadResult,
} from '@altuu/attachment-bridge';
import {
  Button,
  PageHeader,
  Screen,
  Text,
  Icon,
  type IconName,
} from '@altuu/ui';
import { router, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
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
  WebViewMessageEvent,
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
import {
  buildBeforeContentLoadedScript,
  HTML_SNAPSHOT_PREFIX,
  htmlSnapshotScript,
} from './browserScripts';
import { TypedWebView, type WebViewHandle } from '../../shell/TypedWebView';
import {
  loadDownloadCookies,
  loadHunguBrowserSession,
  type BrowserSession,
} from './browserSession';
import { hostOf } from '../../shell/url';

const DEFAULT_TITLE = '網頁';

/** Schemes the WebView renders itself; everything else goes to the system. */
const WEB_SCHEME = /^(https?|about|blob|data):/i;

/** Android has no download hook in react-native-webview, so spot file links. */
const DOWNLOAD_EXTENSION =
  /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|csv|txt|odt|ods|odp)(?:$|[?#])/i;

export function isDownloadUrl(url: string): boolean {
  const path = url.split(/[?#]/)[0] ?? '';

  return DOWNLOAD_EXTENSION.test(url) || DOWNLOAD_EXTENSION.test(path);
}

/** Reports the loaded document's MIME type; iOS renders PDFs natively. */
const DOCUMENT_TYPE_SCRIPT = `window.ReactNativeWebView.postMessage('altuu:contentType:' + document.contentType); true;`;
const DOCUMENT_TYPE_PREFIX = 'altuu:contentType:';

const PDF_PATH = /\.pdf$/i;

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
  const [isPdfDocument, setIsPdfDocument] = useState(false);
  const [exporting, setExporting] = useState<'save' | 'print' | null>(null);
  const htmlSnapshotWaiter = useRef<((html: string) => void) | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

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
        fileName:
          url === request.url
            ? (request.fileName ?? fileNameFromUrl(url))
            : fileNameFromUrl(url),
        headers: { Referer: currentUrl },
        cookies,
      });
    },
    [attachment, currentUrl, request, services, session],
  );

  // Android's WebView cannot render PDFs and never asks
  // onShouldStartLoadWithRequest for the first URL, so download it directly.
  const downloadsInitialUrl =
    Platform.OS === 'android' &&
    request.method !== 'POST' &&
    isDownloadUrl(request.url);
  const initialDownloadStarted = useRef(false);

  useEffect(() => {
    if (!downloadsInitialUrl || session === null) {
      return;
    }

    if (initialDownloadStarted.current) {
      return;
    }

    initialDownloadStarted.current = true;
    void startDownload(request.url);
  }, [downloadsInitialUrl, request.url, session, startDownload]);

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
      // navigationType is iOS-only; Android reports it as undefined.
      (event.navigationType === undefined ||
        event.navigationType === 'click') &&
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

  // Save to Files / print act on the PDF itself, so fetch it with the session.
  const exportCurrentFile = async (action: 'save' | 'print') => {
    if (exporting !== null) {
      return;
    }

    setExporting(action);
    setExportError(null);

    try {
      const cookies = await loadDownloadCookies(
        services,
        session ?? { baseUrl: null, cookies: [] },
        currentUrl,
      );
      const file: DownloadResult = await download({
        url: currentUrl,
        headers: { Referer: currentUrl },
        cookies,
        fileName: request.fileName ?? fileNameFromUrl(currentUrl),
      });

      if (action === 'save') {
        await saveFile(file.uri, file.fileName, file.mimeType);
      } else {
        await printFile(file.uri, file.fileName);
      }
    } catch (error) {
      setExportError(
        error instanceof Error && error.message
          ? error.message
          : action === 'save'
            ? '儲存失敗，請稍後再試。'
            : '列印失敗，請稍後再試。',
      );
    } finally {
      setExporting(null);
    }
  };

  // Asks the page for a script-free HTML copy (see htmlSnapshotScript).
  const snapshotPage = () =>
    new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        htmlSnapshotWaiter.current = null;
        reject(new Error('無法讀取頁面內容。'));
      }, 10000);

      htmlSnapshotWaiter.current = (html) => {
        clearTimeout(timeout);
        htmlSnapshotWaiter.current = null;

        if (html) {
          resolve(html);
        } else {
          reject(new Error('無法讀取頁面內容。'));
        }
      };
      webViewRef.current?.injectJavaScript(htmlSnapshotScript);
    });

  // 自我練習 pages are HTML: render them to PDF on the device.
  const exportCurrentPage = async (action: 'save' | 'print') => {
    if (exporting !== null) {
      return;
    }

    setExporting(action);
    setExportError(null);

    try {
      const html = await snapshotPage();

      if (action === 'print') {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({
          html,
          width: 595,
          height: 842,
        });

        await saveFile(
          uri,
          request.fileName ?? `${DEFAULT_TITLE}.pdf`,
          'application/pdf',
        );
      }
    } catch (error) {
      setExportError(
        error instanceof Error && error.message
          ? error.message
          : action === 'save'
            ? '儲存失敗，請稍後再試。'
            : '列印失敗，請稍後再試。',
      );
    } finally {
      setExporting(null);
    }
  };

  const showPdfActions =
    isPdfDocument || PDF_PATH.test(currentUrl.split(/[?#]/)[0] ?? '');
  const showPageExportActions = request.exportAsPdf && !showPdfActions;
  const runExport = (action: 'save' | 'print') =>
    void (showPageExportActions
      ? exportCurrentPage(action)
      : exportCurrentFile(action));
  const downloading = attachment.state.status === 'downloading';

  return (
    <Screen ignoreTopInset ignoreBottomInset>
      <PageHeader
        title={
          request.title ||
          navigation?.title?.trim() ||
          request.fileName?.replace(/\.pdf$/i, '') ||
          DEFAULT_TITLE
        }
        // The iOS modal sheet already sits below the status bar.
        ignoreTopInset={Platform.OS === 'ios'}
        subtitle={hostOf(currentUrl) || null}
        showBack={false}
        left={<HeaderButton label="完成" icon="x-mark" onPress={close} />}
        right={
          <>
            {showPdfActions ? null : (
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
              </>
            )}
            {showPdfActions || showPageExportActions ? (
              <>
                <HeaderButton
                  label="儲存到檔案"
                  icon="arrow-down-tray"
                  disabled={exporting !== null}
                  onPress={() => runExport('save')}
                />
                <HeaderButton
                  label="列印"
                  icon="printer"
                  disabled={exporting !== null}
                  onPress={() => runExport('print')}
                />
              </>
            ) : null}
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
        {session === null || downloadsInitialUrl ? (
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
            injectedJavaScript={DOCUMENT_TYPE_SCRIPT}
            onMessage={(event: WebViewMessageEvent) => {
              const data = event.nativeEvent.data;

              if (data.startsWith(HTML_SNAPSHOT_PREFIX)) {
                htmlSnapshotWaiter.current?.(
                  data.slice(HTML_SNAPSHOT_PREFIX.length),
                );

                return;
              }

              if (data.startsWith(DOCUMENT_TYPE_PREFIX)) {
                setIsPdfDocument(
                  data.slice(DOCUMENT_TYPE_PREFIX.length) === 'application/pdf',
                );
              }
            }}
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

        {downloading ||
        exporting !== null ||
        exportError !== null ||
        attachment.state.status === 'error' ? (
          <View className="absolute inset-x-3 bottom-4 flex-row items-center gap-3 rounded-xl border border-theme-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800">
            {downloading || exporting !== null ? <ActivityIndicator /> : null}
            <Text className="min-w-0 flex-1 text-sm">
              {exportError !== null
                ? exportError
                : exporting !== null
                  ? '準備檔案中...'
                  : attachment.state.status === 'error'
                    ? attachment.state.message
                    : attachment.state.status === 'downloading' &&
                        attachment.state.progress !== null
                      ? `下載中 ${Math.round(attachment.state.progress * 100)}%`
                      : '下載中...'}
            </Text>
            {exportError !== null || attachment.state.status === 'error' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setExportError(null);
                  attachment.dismiss();
                }}
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
