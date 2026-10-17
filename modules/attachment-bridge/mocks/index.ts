/**
 * Jest mock for `@altuu/attachment-bridge`. It keeps the real JS wrapper and
 * swaps the native module for an in-memory fake built from `jest.fn()`s.
 *
 * Usage in another workspace's test:
 *
 *     jest.mock('@altuu/attachment-bridge', () =>
 *         require('@altuu/attachment-bridge/mock'),
 *     );
 *     import { mockNativeModule, resetAttachmentBridgeMock } from '@altuu/attachment-bridge/mock';
 *
 *     beforeEach(() => resetAttachmentBridgeMock());
 *     mockNativeModule.download.mockRejectedValueOnce(
 *         createAttachmentBridgeError('ERR_HTTP_STATUS', '下載失敗，HTTP 狀態碼：404'),
 *     );
 *     mockNativeModule.emitDownloadProgress({ id, bytesWritten: 1, totalBytes: 2 });
 */
import type {
    AttachmentBridgeNativeModule,
    DownloadProgressEvent,
    DownloadResult,
    NativeBridgeCookie,
    NativeDownloadRequest,
} from '../src/AttachmentBridge.types';
import { createAttachmentBridge } from '../src/createAttachmentBridge';

export * from '../src/AttachmentBridge.types';
export {
    createAttachmentBridge,
    createDownloadId,
    type AttachmentBridge,
} from '../src/createAttachmentBridge';
export {
    createAttachmentBridgeError,
    isAttachmentBridgeError,
    type AttachmentBridgeError,
} from '../src/errors';

type Mocked<T> = T extends (...args: infer A) => infer R
    ? jest.Mock<R, A>
    : never;

export type MockAttachmentBridgeNativeModule = {
    [K in keyof AttachmentBridgeNativeModule]: Mocked<
        AttachmentBridgeNativeModule[K]
    >;
} & {
    /** Cookies written via `setWebViewCookies`, keyed by URL. */
    webViewCookies: Map<string, NativeBridgeCookie[]>;
    /** Delivers a progress event to every `onDownloadProgress` listener. */
    emitDownloadProgress(event: DownloadProgressEvent): void;
    listenerCount(): number;
    /** Restores the default implementations and clears recorded state. */
    reset(): void;
};

function fileNameFromUrl(url: string): string {
    const path = url.split(/[?#]/)[0] ?? '';
    const lastSegment = path.split('/').pop() ?? '';

    try {
        return decodeURIComponent(lastSegment) || 'download.bin';
    } catch {
        return lastSegment || 'download.bin';
    }
}

/** Default result of the fake `download`. */
export function mockDownloadResult(
    request: Pick<NativeDownloadRequest, 'id' | 'url' | 'fileName'>,
): DownloadResult {
    const fileName = request.fileName ?? fileNameFromUrl(request.url);

    return {
        uri: `file:///mock-cache/attachments/${request.id}/${encodeURIComponent(fileName)}`,
        mimeType: 'application/octet-stream',
        size: 0,
        fileName,
    };
}

export function createMockAttachmentBridgeNativeModule(): MockAttachmentBridgeNativeModule {
    const listeners = new Set<(event: DownloadProgressEvent) => void>();
    const webViewCookies = new Map<string, NativeBridgeCookie[]>();

    const mock = {
        webViewCookies,
        setWebViewCookies: jest.fn(),
        clearWebViewCookies: jest.fn(),
        download: jest.fn(),
        cancelDownload: jest.fn(),
        previewFile: jest.fn(),
        saveFile: jest.fn(),
        readLegacyNativePhpAppKey: jest.fn(),
        fileExists: jest.fn(),
        addListener: jest.fn(),
        emitDownloadProgress(event: DownloadProgressEvent) {
            listeners.forEach((listener) => listener(event));
        },
        listenerCount: () => listeners.size,
        reset() {
            listeners.clear();
            webViewCookies.clear();

            mock.setWebViewCookies
                .mockReset()
                .mockImplementation(async (url, cookies) => {
                    webViewCookies.set(url, [
                        ...(webViewCookies.get(url) ?? []),
                        ...cookies,
                    ]);
                });
            mock.clearWebViewCookies
                .mockReset()
                .mockImplementation(async () => webViewCookies.clear());
            mock.download
                .mockReset()
                .mockImplementation(async (request) =>
                    mockDownloadResult(request),
                );
            mock.cancelDownload
                .mockReset()
                .mockImplementation(async () => false);
            mock.previewFile.mockReset().mockImplementation(async () => {});
            mock.saveFile
                .mockReset()
                .mockImplementation(async () => ({ saved: true }));
            mock.readLegacyNativePhpAppKey
                .mockReset()
                .mockImplementation(async () => null);
            mock.fileExists.mockReset().mockImplementation(async () => false);
            mock.addListener
                .mockReset()
                .mockImplementation((_eventName, listener) => {
                    listeners.add(listener);

                    return { remove: () => listeners.delete(listener) };
                });
        },
    } as MockAttachmentBridgeNativeModule;

    mock.reset();

    return mock;
}

export const mockNativeModule = createMockAttachmentBridgeNativeModule();

export function resetAttachmentBridgeMock(): void {
    mockNativeModule.reset();
}

const attachmentBridge = createAttachmentBridge(mockNativeModule);

export const {
    setWebViewCookies,
    clearWebViewCookies,
    addDownloadProgressListener,
    startDownload,
    download,
    cancelDownload,
    previewFile,
    saveFile,
    readLegacyNativePhpAppKey,
    fileExists,
} = attachmentBridge;

export default attachmentBridge;
