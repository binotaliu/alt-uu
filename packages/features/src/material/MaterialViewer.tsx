import type {
  CourseMaterialResource,
  ParsedMaterialContent,
} from '@altuu/core';
import { Text } from '@altuu/ui';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { MaterialHtmlView } from './MaterialHtmlView';
import { MaterialIcon } from './MaterialIcon';
import {
  FONT_SCALE_DEFAULT,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_STEP,
  type MaterialHtmlPalette,
} from './materialHtmlDocument';
import { PlaybackRateMenu } from './player/PlaybackRateMenu';

export interface MaterialViewerProps {
  content: ParsedMaterialContent;
  resources: CourseMaterialResource[];
  /** Whether the HUNGU cookies for `content.baseUrl` are in place. */
  cookiesReady: boolean;
  fontScale: number;
  isSavingFontScale: boolean;
  isDark: boolean;
  palette: MaterialHtmlPalette;
  canOpenInAppBrowser: boolean;
  isReloading: boolean;
  reloadError: string | null;
  /** Video (not audio / YouTube): rate menu and frame capture. */
  showVideoTools: boolean;
  videoRate: number;
  isCapturingFrame: boolean;
  captureError: string | null;
  isDownloading: boolean;
  downloadProgress: number | null;
  downloadError: string | null;
  onOpenInAppBrowser: () => void;
  onReload: () => void;
  onCaptureFrame: () => void;
  onVideoRateChange: (rate: number) => void;
  onDownload: () => void;
  onFontScaleChange: (scale: number) => void;
  onLinkPress: (href: string) => void;
  onImagePress: (src: string, alt: string) => void;
}

const toolButton =
  'h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-theme-200 bg-white dark:border-zinc-600 dark:bg-zinc-700';

/**
 * Everything below the player (legacy MaterialViewer): the action bar
 * (in-app browser, reload, capture, speed, download), the HTML article with
 * font size controls or the download card, the empty notice and the
 * attachment list.
 */
export function MaterialViewer({
  content,
  resources,
  cookiesReady,
  fontScale,
  isSavingFontScale,
  isDark,
  palette,
  canOpenInAppBrowser,
  isReloading,
  reloadError,
  showVideoTools,
  videoRate,
  isCapturingFrame,
  captureError,
  isDownloading,
  downloadProgress,
  downloadError,
  onOpenInAppBrowser,
  onReload,
  onCaptureFrame,
  onVideoRateChange,
  onDownload,
  onFontScaleChange,
  onLinkPress,
  onImagePress,
}: MaterialViewerProps) {
  const html = (content.htmlContent ?? '').trim();
  const hasHtml = html !== '';
  const hasDownload = !!content.downloadUrl;
  const hasYoutube =
    content.videoProvider === 'youtube' && !!content.embedVideoUrl;
  const canZoomOut = fontScale > FONT_SCALE_MIN + 1e-6;
  const canZoomIn = fontScale < FONT_SCALE_MAX - 1e-6;
  const downloadLabel = isDownloading
    ? downloadProgress === null
      ? '下載中...'
      : `下載中 ${Math.round(downloadProgress * 100)}%`
    : content.isPdf
      ? '下載 PDF'
      : '下載檔案';

  return (
    <View className="gap-3">
      {captureError ? (
        <Text className="px-1 text-xs text-red-600">{captureError}</Text>
      ) : null}
      {reloadError ? (
        <Text className="px-1 text-xs text-red-600">{reloadError}</Text>
      ) : null}

      <View className="flex-row items-stretch gap-2 rounded-2xl border border-theme-200 bg-white/90 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
        <Pressable
          accessibilityRole="button"
          disabled={!canOpenInAppBrowser}
          onPress={onOpenInAppBrowser}
          className={`h-10 min-w-0 flex-1 justify-center rounded-lg border border-theme-200 bg-white px-3 dark:border-zinc-600 dark:bg-zinc-700 ${canOpenInAppBrowser ? '' : 'opacity-50'}`}
        >
          <Text
            numberOfLines={1}
            className="text-center text-sm font-medium text-theme-900 dark:text-zinc-100"
          >
            使用內建瀏覽器開啟
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="重新載入教材"
          disabled={isReloading}
          onPress={onReload}
          className={`${toolButton} ${isReloading ? 'opacity-50' : ''}`}
        >
          {isReloading ? (
            <ActivityIndicator size="small" />
          ) : (
            <MaterialIcon
              name="reload"
              className="text-theme-900 dark:text-zinc-100"
            />
          )}
        </Pressable>

        {showVideoTools ? (
          <>
            <PlaybackRateMenu rate={videoRate} onSelect={onVideoRateChange} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="截取畫面"
              disabled={isCapturingFrame}
              onPress={onCaptureFrame}
              className={`${toolButton} ${isCapturingFrame ? 'opacity-50' : ''}`}
            >
              {isCapturingFrame ? (
                <ActivityIndicator size="small" />
              ) : (
                <MaterialIcon
                  name="camera"
                  className="text-theme-900 dark:text-zinc-100"
                />
              )}
            </Pressable>
          </>
        ) : null}

        {hasDownload ? (
          <Pressable
            accessibilityRole="button"
            disabled={isDownloading}
            onPress={onDownload}
            className={`h-10 shrink-0 flex-row items-center justify-center gap-2 rounded-lg border border-theme-200 bg-white px-3 dark:border-zinc-600 dark:bg-zinc-700 ${isDownloading ? 'opacity-50' : ''}`}
          >
            {isDownloading ? <ActivityIndicator size="small" /> : null}
            <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
              {downloadLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {hasHtml && !hasDownload ? (
        <View className="overflow-hidden rounded-2xl border border-theme-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <View className="flex-row justify-end border-b border-theme-200 px-4 py-2 dark:border-zinc-700">
            <View className="flex-row items-center gap-1 rounded-xl border border-theme-200 bg-theme-50 p-1 dark:border-zinc-700 dark:bg-zinc-800">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="縮小字體"
                disabled={!canZoomOut || isSavingFontScale}
                onPress={() => onFontScaleChange(fontScale - FONT_SCALE_STEP)}
                className={`h-8 w-8 items-center justify-center rounded-lg border border-theme-200 bg-white dark:border-zinc-600 dark:bg-zinc-700 ${!canZoomOut || isSavingFontScale ? 'opacity-50' : ''}`}
              >
                <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
                  A-
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="重設字體大小"
                onPress={() => onFontScaleChange(FONT_SCALE_DEFAULT)}
                className="h-8 w-12 items-center justify-center rounded-lg"
              >
                <Text className="text-sm font-semibold tabular-nums text-theme-900 dark:text-zinc-100">
                  {`${Math.round(fontScale * 100)}%`}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="放大字體"
                disabled={!canZoomIn || isSavingFontScale}
                onPress={() => onFontScaleChange(fontScale + FONT_SCALE_STEP)}
                className={`h-8 w-8 items-center justify-center rounded-lg border border-theme-200 bg-white dark:border-zinc-600 dark:bg-zinc-700 ${!canZoomIn || isSavingFontScale ? 'opacity-50' : ''}`}
              >
                <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
                  A+
                </Text>
              </Pressable>
            </View>
          </View>
          {cookiesReady && content.baseUrl ? (
            <MaterialHtmlView
              html={html}
              baseUrl={content.baseUrl}
              fontScale={fontScale}
              isDark={isDark}
              palette={palette}
              onLinkPress={onLinkPress}
              onImagePress={onImagePress}
            />
          ) : (
            <View className="h-24 items-center justify-center">
              <ActivityIndicator size="small" />
            </View>
          )}
        </View>
      ) : hasDownload ? (
        <View className="rounded-2xl border border-theme-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <Text className="mb-3 text-sm text-theme-900 dark:text-zinc-300">
            {content.isPdf
              ? '本教材為 PDF 檔案，您可以下載後以其他 App 開啟或使用內建瀏覽器檢視。'
              : `本教材為可下載檔案（${content.downloadFileExtension ? `.${content.downloadFileExtension}` : ''}），請下載後以其他 App 開啟。`}
          </Text>
          {downloadError ? (
            <Text className="text-sm text-red-600 dark:text-red-400">
              {downloadError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {!content.videoUrl && !hasYoutube && !hasHtml && !hasDownload ? (
        <View className="rounded-xl border border-dashed border-theme-300 bg-theme-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <Text className="text-sm text-theme-700 dark:text-zinc-400">
            此節點沒有可顯示的教材內容。
          </Text>
        </View>
      ) : null}

      {resources.length > 1 ? (
        <View className="rounded-2xl border border-theme-200 bg-white/90 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <Text className="mb-2 text-sm font-semibold text-theme-900 dark:text-zinc-100">
            附件資源
          </Text>
          <View className="gap-2">
            {resources.map((resource, index) => (
              <View
                key={index}
                className="rounded-lg border border-theme-200 bg-theme-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <Text className="text-sm text-theme-800 dark:text-zinc-300">
                  {resource.filename ||
                    resource.title ||
                    resource.href ||
                    `資源 ${index + 1}`}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
