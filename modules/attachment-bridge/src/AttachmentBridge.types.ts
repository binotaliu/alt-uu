/**
 * A cookie to seed into the platform WebView cookie store or to send with a
 * download. `domain` defaults to the host of the URL it is set for
 * (a host-only cookie); `path` defaults to `/`.
 */
export type BridgeCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  /** Expiry as a Date or epoch milliseconds. Omit for a session cookie. */
  expires?: Date | number;
};

/** Cookie shape sent over the native boundary (`expires` is epoch ms). */
export type NativeBridgeCookie = Omit<BridgeCookie, 'expires'> & {
  expires?: number;
};

export type DownloadProgressEvent = {
  /** The download id returned by / passed to `download`. */
  id: string;
  bytesWritten: number;
  /** `-1` when the server did not send a Content-Length. */
  totalBytes: number;
};

export type DownloadOptions = {
  url: string;
  /**
   * Extra request headers (e.g. `User-Agent`, `Referer`). Sent on every
   * redirect hop. Put session cookies in `cookies`, not in a `Cookie`
   * header, so they are only sent to matching hosts.
   */
  headers?: Record<string, string>;
  /**
   * Cookies for this download only. They are matched per request (domain,
   * path, secure) on every redirect hop, and `Set-Cookie` from redirects is
   * merged in. No shared/system cookie jar is read or written.
   */
  cookies?: BridgeCookie[];
  /**
   * Preferred file name (e.g. the material title). Wins over the server
   * name; when it has no extension the server name's or the MIME type's
   * extension is appended.
   */
  fileName?: string;
  method?: 'GET' | 'POST';
  /**
   * Raw POST body (set `Content-Type` in `headers`). Dropped when a
   * 301/302/303 redirect turns the request into a GET.
   */
  body?: string;
  /** Caller-chosen id used to filter progress events and to cancel. */
  id?: string;
  onProgress?: (event: DownloadProgressEvent) => void;
};

export type NativeDownloadRequest = {
  id: string;
  url: string;
  headers: Record<string, string>;
  cookies: NativeBridgeCookie[];
  fileName: string | null;
  method: 'GET' | 'POST';
  body: string | null;
};

export type DownloadResult = {
  /** `file://` URI inside the app cache dir (`attachments/<id>/<fileName>`). */
  uri: string;
  mimeType: string;
  /** Size in bytes. */
  size: number;
  fileName: string;
};

export type StartedDownload = {
  id: string;
  promise: Promise<DownloadResult>;
  cancel: () => Promise<boolean>;
};

export type SaveFileResult = {
  /** `false` when the user dismissed the picker. */
  saved: boolean;
};

export const ATTACHMENT_BRIDGE_ERROR_CODES = [
  'ERR_INVALID_URL',
  'ERR_INVALID_COOKIE',
  'ERR_INVALID_ARGUMENT',
  'ERR_HTTP_STATUS',
  'ERR_EMPTY_BODY',
  'ERR_TOO_MANY_REDIRECTS',
  'ERR_DOWNLOAD_FAILED',
  'ERR_DOWNLOAD_CANCELLED',
  'ERR_FILE_NOT_FOUND',
  'ERR_NO_VIEWER',
  'ERR_NO_PRESENTER',
  'ERR_SAVE_IN_PROGRESS',
  'ERR_SAVE_FAILED',
  'ERR_LEGACY_READ_FAILED',
] as const;

export type AttachmentBridgeErrorCode =
  (typeof ATTACHMENT_BRIDGE_ERROR_CODES)[number];

export type AttachmentBridgeModuleEvents = {
  onDownloadProgress: (event: DownloadProgressEvent) => void;
};

/** Minimal subscription handle (structurally `EventSubscription` from expo). */
export type BridgeSubscription = { remove: () => void };

/**
 * The raw native module surface. Kept structural (instead of extending
 * expo's `NativeModule` class) so tests and the Jest mock can provide it.
 */
export interface AttachmentBridgeNativeModule {
  setWebViewCookies(url: string, cookies: NativeBridgeCookie[]): Promise<void>;
  clearWebViewCookies(): Promise<void>;
  download(request: NativeDownloadRequest): Promise<DownloadResult>;
  cancelDownload(id: string): Promise<boolean>;
  previewFile(uri: string, mimeType: string | null): Promise<void>;
  saveFile(
    uri: string,
    fileName: string,
    mimeType: string | null,
  ): Promise<SaveFileResult>;
  readLegacyNativePhpAppKey(): Promise<string | null>;
  fileExists(path: string): Promise<boolean>;
  addListener(
    eventName: 'onDownloadProgress',
    listener: (event: DownloadProgressEvent) => void,
  ): BridgeSubscription;
}
