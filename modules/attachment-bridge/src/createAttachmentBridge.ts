import type {
  AttachmentBridgeNativeModule,
  BridgeCookie,
  BridgeSubscription,
  CornerInsets,
  DownloadOptions,
  DownloadProgressEvent,
  DownloadResult,
  NativeBridgeCookie,
  ReservedRegion,
  SaveFileResult,
  StartedDownload,
  VideoFrameResult,
} from './AttachmentBridge.types';
import { normalizeAttachmentBridgeError } from './errors';

export type AttachmentBridge = {
  /**
   * Writes cookies into the platform WebView cookie store so a
   * `react-native-webview` loading `url` carries the session.
   *
   * iOS: `WKWebsiteDataStore.default()` only (never `HTTPCookieStorage.shared`,
   * which `fetch` also uses). Render the WebView WITHOUT `sharedCookiesEnabled`,
   * `incognito` or `cacheEnabled={false}`: each of those makes
   * react-native-webview 14 use a non-persistent store that never sees them.
   *
   * Android: the process-wide `CookieManager` (flushed). React Native's own
   * networking reads that jar too, unless a request omits credentials.
   */
  setWebViewCookies(url: string, cookies: BridgeCookie[]): Promise<void>;
  /** Removes every cookie from the WebView cookie store. */
  clearWebViewCookies(): Promise<void>;
  /** Progress of all downloads; filter by `event.id`. */
  addDownloadProgressListener(
    listener: (event: DownloadProgressEvent) => void,
  ): BridgeSubscription;
  /**
   * Fires when the iPhone Duo hinge changes status (closed, half-open, open), after which
   * `getReservedRegions` reports the new fold. Never fires elsewhere, or when the native
   * module predates it.
   */
  addFoldChangeListener(listener: () => void): BridgeSubscription;
  /** Starts a download and returns its id before it settles. */
  startDownload(options: DownloadOptions): StartedDownload;
  /**
   * Downloads `url` into the app cache (`attachments/<id>/<fileName>`) with
   * an isolated, explicit cookie set. Rejects with an `AttachmentBridgeError`.
   */
  download(options: DownloadOptions): Promise<DownloadResult>;
  /** Cancels an in-flight download. Resolves `false` if none matched. */
  cancelDownload(id: string): Promise<boolean>;
  /**
   * Opens a local file in QuickLook (iOS) or another app via `ACTION_VIEW`
   * (Android). Resolves once presented. Rejects with `ERR_NO_VIEWER` when
   * nothing can open the type; offer `saveFile` then.
   */
  previewFile(uri: string, mimeType?: string): Promise<void>;
  /**
   * Lets the user export a local file via the system document picker
   * (iOS `forExporting`, Android `ACTION_CREATE_DOCUMENT`).
   */
  saveFile(
    uri: string,
    fileName: string,
    mimeType?: string,
  ): Promise<SaveFileResult>;
  /**
   * Reads (never modifies) the Laravel `APP_KEY` the old NativePHP app
   * generated on this device: iOS Keychain generic password (service =
   * bundle id, account `APP_KEY`) or Android
   * `<dataDir>/app_storage/persisted_data/appkey.txt`. Resolves `null`
   * when there is none. Rejects with `ERR_LEGACY_READ_FAILED` when the
   * store exists but cannot be read (e.g. device locked), so callers can
   * retry instead of treating the key as lost.
   */
  readLegacyNativePhpAppKey(): Promise<string | null>;
  /**
   * Whether a regular file exists at `path` (`file://` URI or absolute
   * path). Rejects with `ERR_INVALID_URL` for anything else.
   */
  fileExists(path: string): Promise<boolean>;
  /**
   * Decodes the frame at `seconds` of a remote video, including HLS
   * (`.m3u8`) streams that `AVAssetImageGenerator` cannot read. iOS only:
   * rejects elsewhere (the native function is missing) and with
   * `ERR_FRAME_CAPTURE_FAILED` when no frame arrives.
   */
  captureVideoFrame(url: string, seconds: number): Promise<VideoFrameResult>;
  /**
   * Margins that keep content clear of the iPadOS 26 windowed-mode window
   * controls (`UIWindow.edgeInsets(for: .margins(cornerAdaptation:))`, the
   * legacy `--corner-inset-*` CSS variables). Zeros everywhere else, and
   * when the native module predates the function. Re-read when the window
   * is resized: the controls change shape with the window.
   */
  getCornerInsets(): Promise<CornerInsets>;
  /**
   * Fold and camera regions of the key window (iPhone Duo, iOS 27.1+), inactive ones
   * included. Empty everywhere else, and when the native module predates the function.
   * Re-read when the window is resized: folding changes the window size.
   */
  getReservedRegions(): Promise<ReservedRegion[]>;
};

const NO_CORNER_INSETS: CornerInsets = { top: 0, right: 0, bottom: 0, left: 0 };

let downloadSequence = 0;

/** Unique within the app process; ids only need to be unique in flight. */
export function createDownloadId(): string {
  downloadSequence += 1;
  const random = Math.random().toString(36).slice(2, 8);

  return `dl-${Date.now().toString(36)}-${downloadSequence}-${random}`;
}

export function toNativeCookie(cookie: BridgeCookie): NativeBridgeCookie {
  const { expires, ...rest } = cookie;
  const native: NativeBridgeCookie = { ...rest };

  if (expires !== undefined) {
    native.expires =
      expires instanceof Date ? expires.getTime() : Number(expires);
  }

  return native;
}

async function rethrowNormalized<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    throw normalizeAttachmentBridgeError(error);
  }
}

/** Wraps the raw native module with the public, typed API. */
export function createAttachmentBridge(
  nativeModule: AttachmentBridgeNativeModule,
): AttachmentBridge {
  const addDownloadProgressListener: AttachmentBridge['addDownloadProgressListener'] =
    (listener) => nativeModule.addListener('onDownloadProgress', listener);

  const cancelDownload: AttachmentBridge['cancelDownload'] = (id) =>
    nativeModule.cancelDownload(id);

  const startDownload: AttachmentBridge['startDownload'] = (options) => {
    const id = options.id ?? createDownloadId();
    const { onProgress } = options;
    const subscription = onProgress
      ? addDownloadProgressListener((event) => {
          if (event.id === id) {
            onProgress(event);
          }
        })
      : null;

    let nativePromise: Promise<DownloadResult>;

    try {
      nativePromise = nativeModule.download({
        id,
        url: options.url,
        headers: options.headers ?? {},
        cookies: (options.cookies ?? []).map(toNativeCookie),
        fileName: options.fileName?.trim() || null,
        method: options.method ?? 'GET',
        body: options.body ?? null,
      });
    } catch (error) {
      nativePromise = Promise.reject(error);
    }

    const promise = rethrowNormalized(nativePromise).finally(() =>
      subscription?.remove(),
    );

    return { id, promise, cancel: () => cancelDownload(id) };
  };

  return {
    async setWebViewCookies(url, cookies) {
      if (cookies.length === 0) {
        return;
      }

      await rethrowNormalized(
        nativeModule.setWebViewCookies(url, cookies.map(toNativeCookie)),
      );
    },
    clearWebViewCookies: () => nativeModule.clearWebViewCookies(),
    addDownloadProgressListener,
    addFoldChangeListener(listener) {
      try {
        return nativeModule.addListener('onFoldChange', listener);
      } catch {
        return { remove: () => {} };
      }
    },
    startDownload,
    download: (options) => startDownload(options).promise,
    cancelDownload,
    previewFile: (uri, mimeType) =>
      rethrowNormalized(nativeModule.previewFile(uri, mimeType ?? null)),
    saveFile: (uri, fileName, mimeType) =>
      rethrowNormalized(nativeModule.saveFile(uri, fileName, mimeType ?? null)),
    readLegacyNativePhpAppKey: () =>
      rethrowNormalized(nativeModule.readLegacyNativePhpAppKey()),
    fileExists: (path) => rethrowNormalized(nativeModule.fileExists(path)),
    captureVideoFrame: (url, seconds) =>
      rethrowNormalized(nativeModule.captureVideoFrame(url, seconds)),
    async getReservedRegions() {
      if (typeof nativeModule.getReservedRegions !== 'function') {
        return [];
      }

      try {
        return await nativeModule.getReservedRegions();
      } catch {
        return [];
      }
    },
    async getCornerInsets() {
      if (typeof nativeModule.getCornerInsets !== 'function') {
        return NO_CORNER_INSETS;
      }

      try {
        return await nativeModule.getCornerInsets();
      } catch {
        return NO_CORNER_INSETS;
      }
    },
  };
}
