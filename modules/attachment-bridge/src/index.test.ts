import {
  createAttachmentBridgeError,
  mockNativeModule,
  resetAttachmentBridgeMock,
} from '../mocks';

import {
  addFoldChangeListener,
  cancelDownload,
  clearWebViewCookies,
  download,
  fileExists,
  getCornerInsets,
  getReservedRegions,
  isAttachmentBridgeError,
  previewFile,
  readLegacyNativePhpAppKey,
  saveFile,
  setWebViewCookies,
  startDownload,
  type DownloadProgressEvent,
} from './index';

jest.mock('./AttachmentBridgeModule', () => ({
  __esModule: true,
  default: jest.requireActual('../mocks').mockNativeModule,
}));

beforeEach(() => resetAttachmentBridgeMock());

describe('setWebViewCookies', () => {
  it('converts Date expiry to epoch milliseconds', async () => {
    const expires = new Date('2026-10-18T00:00:00Z');

    await setWebViewCookies('https://uu.nou.edu.tw/learn/', [
      { name: 'PHPSESSID', value: 'abc', domain: '.nou.edu.tw', expires },
      { name: 'idx', value: '1', secure: true },
    ]);

    expect(mockNativeModule.setWebViewCookies).toHaveBeenCalledWith(
      'https://uu.nou.edu.tw/learn/',
      [
        {
          name: 'PHPSESSID',
          value: 'abc',
          domain: '.nou.edu.tw',
          expires: expires.getTime(),
        },
        { name: 'idx', value: '1', secure: true },
      ],
    );
  });

  it('skips the native call when there are no cookies', async () => {
    await setWebViewCookies('https://example.com', []);

    expect(mockNativeModule.setWebViewCookies).not.toHaveBeenCalled();
  });

  it('clears cookies', async () => {
    await setWebViewCookies('https://example.com', [{ name: 'a', value: 'b' }]);
    await clearWebViewCookies();

    expect(mockNativeModule.webViewCookies.size).toBe(0);
  });
});

describe('download', () => {
  it('sends a normalised request and resolves the native result', async () => {
    const result = await download({
      url: 'https://uu.nou.edu.tw/base/10001/course/a.pdf',
      headers: { 'User-Agent': 'UA' },
      cookies: [{ name: 's', value: '1', expires: 1700000000000 }],
      fileName: '  講義  ',
      id: 'fixed-id',
    });

    expect(mockNativeModule.download).toHaveBeenCalledWith({
      id: 'fixed-id',
      url: 'https://uu.nou.edu.tw/base/10001/course/a.pdf',
      headers: { 'User-Agent': 'UA' },
      cookies: [{ name: 's', value: '1', expires: 1700000000000 }],
      fileName: '講義',
      method: 'GET',
      body: null,
    });
    expect(result.fileName).toBe('講義');
    expect(result.uri).toContain('/attachments/fixed-id/');
  });

  it('defaults optional fields and generates unique ids', async () => {
    const first = startDownload({ url: 'https://example.com/x.pdf' });
    const second = startDownload({ url: 'https://example.com/y.pdf' });

    await Promise.all([first.promise, second.promise]);

    expect(first.id).not.toBe(second.id);
    expect(mockNativeModule.download).toHaveBeenNthCalledWith(1, {
      id: first.id,
      url: 'https://example.com/x.pdf',
      headers: {},
      cookies: [],
      fileName: null,
      method: 'GET',
      body: null,
    });
  });

  it('forwards only its own progress events and unsubscribes when settled', async () => {
    let finish: () => void = () => {};
    mockNativeModule.download.mockImplementationOnce(
      (request) =>
        new Promise((resolve) => {
          finish = () =>
            resolve({
              uri: `file:///c/attachments/${request.id}/a.pdf`,
              mimeType: 'application/pdf',
              size: 10,
              fileName: 'a.pdf',
            });
        }),
    );
    const events: DownloadProgressEvent[] = [];

    const started = startDownload({
      url: 'https://example.com/a.pdf',
      id: 'mine',
      onProgress: (event) => events.push(event),
    });

    mockNativeModule.emitDownloadProgress({
      id: 'other',
      bytesWritten: 1,
      totalBytes: 10,
    });
    mockNativeModule.emitDownloadProgress({
      id: 'mine',
      bytesWritten: 5,
      totalBytes: 10,
    });
    expect(mockNativeModule.listenerCount()).toBe(1);

    finish();
    await started.promise;

    expect(events).toEqual([{ id: 'mine', bytesWritten: 5, totalBytes: 10 }]);
    expect(mockNativeModule.listenerCount()).toBe(0);
  });

  it('unsubscribes and exposes httpStatus on HTTP errors', async () => {
    mockNativeModule.download.mockRejectedValueOnce(
      createAttachmentBridgeError(
        'ERR_HTTP_STATUS',
        '下載失敗，HTTP 狀態碼：404',
      ),
    );

    const error = await download({
      url: 'https://example.com/missing',
      onProgress: () => {},
    }).catch((caught: unknown) => caught);

    expect(isAttachmentBridgeError(error, 'ERR_HTTP_STATUS')).toBe(true);
    expect(error).toMatchObject({ httpStatus: 404 });
    expect(mockNativeModule.listenerCount()).toBe(0);
  });

  it('cancels by id', async () => {
    mockNativeModule.cancelDownload.mockResolvedValueOnce(true);
    const started = startDownload({ url: 'https://example.com/a' });

    await expect(started.cancel()).resolves.toBe(true);
    await expect(cancelDownload('nope')).resolves.toBe(false);
    expect(mockNativeModule.cancelDownload).toHaveBeenNthCalledWith(
      1,
      started.id,
    );
    await started.promise;
  });
});

describe('previewFile / saveFile', () => {
  it('passes null for a missing mime type', async () => {
    await previewFile('file:///c/a.pdf');
    await expect(
      saveFile('file:///c/a.pdf', 'a.pdf', 'application/pdf'),
    ).resolves.toEqual({ saved: true });

    expect(mockNativeModule.previewFile).toHaveBeenCalledWith(
      'file:///c/a.pdf',
      null,
    );
    expect(mockNativeModule.saveFile).toHaveBeenCalledWith(
      'file:///c/a.pdf',
      'a.pdf',
      'application/pdf',
    );
  });

  it('rejects with typed error codes', async () => {
    mockNativeModule.previewFile.mockRejectedValueOnce(
      createAttachmentBridgeError('ERR_NO_VIEWER', 'no app'),
    );

    const error = await previewFile('file:///c/a.xyz').catch(
      (caught: unknown) => caught,
    );

    expect(isAttachmentBridgeError(error, 'ERR_NO_VIEWER')).toBe(true);
    expect(isAttachmentBridgeError(error, 'ERR_SAVE_FAILED')).toBe(false);
    expect(isAttachmentBridgeError(new Error('plain'))).toBe(false);
  });
});

describe('legacy NativePHP access', () => {
  it('reads the legacy APP_KEY, null by default', async () => {
    await expect(readLegacyNativePhpAppKey()).resolves.toBeNull();

    mockNativeModule.readLegacyNativePhpAppKey.mockResolvedValueOnce(
      'base64:abc=',
    );

    await expect(readLegacyNativePhpAppKey()).resolves.toBe('base64:abc=');
  });

  it('rejects with ERR_LEGACY_READ_FAILED when the store is unreadable', async () => {
    mockNativeModule.readLegacyNativePhpAppKey.mockRejectedValueOnce(
      createAttachmentBridgeError('ERR_LEGACY_READ_FAILED', 'locked'),
    );

    const error = await readLegacyNativePhpAppKey().catch(
      (caught: unknown) => caught,
    );

    expect(isAttachmentBridgeError(error, 'ERR_LEGACY_READ_FAILED')).toBe(true);
  });

  it('checks file existence and surfaces invalid paths', async () => {
    mockNativeModule.fileExists.mockResolvedValueOnce(true);

    await expect(fileExists('/data/db.sqlite')).resolves.toBe(true);
    expect(mockNativeModule.fileExists).toHaveBeenCalledWith('/data/db.sqlite');
    await expect(fileExists('file:///missing')).resolves.toBe(false);

    mockNativeModule.fileExists.mockRejectedValueOnce(
      createAttachmentBridgeError('ERR_INVALID_URL', 'relative'),
    );

    await expect(fileExists('relative/path')).rejects.toMatchObject({
      code: 'ERR_INVALID_URL',
    });
  });
});

describe('getCornerInsets', () => {
  it('returns the native insets', async () => {
    mockNativeModule.getCornerInsets.mockResolvedValueOnce({
      top: 0,
      right: 0,
      bottom: 0,
      left: 84,
    });

    await expect(getCornerInsets()).resolves.toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 84,
    });
  });

  it('falls back to zeros when the native call fails', async () => {
    mockNativeModule.getCornerInsets.mockRejectedValueOnce(new Error('boom'));

    await expect(getCornerInsets()).resolves.toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });
});

describe('getReservedRegions', () => {
  it('returns the native regions', async () => {
    const regions = [
      {
        kind: 'division' as const,
        active: true,
        frame: { x: 400, y: 0, width: 12, height: 800 },
      },
    ];
    mockNativeModule.getReservedRegions.mockResolvedValueOnce(regions);

    await expect(getReservedRegions()).resolves.toEqual(regions);
  });

  it('falls back to no regions when the native call fails', async () => {
    mockNativeModule.getReservedRegions.mockRejectedValueOnce(
      new Error('boom'),
    );

    await expect(getReservedRegions()).resolves.toEqual([]);
  });
});

describe('addFoldChangeListener', () => {
  it('delivers fold changes until removed', () => {
    const listener = jest.fn();
    const subscription = addFoldChangeListener(listener);

    mockNativeModule.emitFoldChange();
    subscription.remove();
    mockNativeModule.emitFoldChange();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
