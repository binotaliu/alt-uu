import {
    createAttachmentBridgeError,
    type DownloadResult,
    mockNativeModule,
    resetAttachmentBridgeMock,
} from '@altuu/attachment-bridge/mock';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { openInAppBrowser } from '../../shell/openUrl';
import { renderWithServices } from '../testUtils';
import {
    CourseHomeworkTab,
    extractDownloadFilename,
} from './CourseHomeworkTab';

jest.mock('@altuu/attachment-bridge', () =>
    jest.requireActual('@altuu/attachment-bridge/mock'),
);
jest.mock('../../shell/openUrl', () => ({
    openInAppBrowser: jest.fn(),
    openExternalUrl: jest.fn(),
}));

const NOTICE_URL =
    'https://noustud.nou.edu.tw/download.php?filename=%E4%BD%9C%E6%A5%AD1&x=1';

const services = () => ({
    course: {
        getHomeworks: jest.fn(async () => ({
            homeworkItems: [
                {
                    title: '平台作業',
                    percent: '20%',
                    type: 'homework',
                    status: '未繳交',
                    window: '10/1 - 10/20',
                    actionUrl: 'https://uu.nou.edu.tw/hw/do',
                    resultUrl: null,
                    source: 'hungu',
                    isSubmitted: false,
                    resultUnavailableReason: null,
                },
            ],
            schoolPortalNotices: [
                {
                    title: '教務系統作業 A',
                    dueDate: '2026/10/30',
                    submissionMethod: '郵寄',
                    downloadUrl: NOTICE_URL,
                },
            ],
        })),
    },
    schoolPortal: {
        proxy: {
            downloadHandoff: jest.fn(async (url: string) => ({
                url,
                headers: {
                    'user-agent': 'UA',
                    Cookie: 'ASP.NET_SessionId=abc',
                    accept: '*/*',
                },
                baseUrl: 'https://noustud.nou.edu.tw',
                cookies: { 'ASP.NET_SessionId': 'abc' },
            })),
        },
    },
});

beforeEach(() => resetAttachmentBridgeMock());

describe('extractDownloadFilename', () => {
    it('uses the portal filename query value with a pdf extension', () => {
        expect(extractDownloadFilename(NOTICE_URL)).toBe('作業1.pdf');
        expect(extractDownloadFilename('https://x.test/a')).toBeNull();
    });
});

describe('CourseHomeworkTab attachment download', () => {
    it('downloads with isolated cookies, then previews the file', async () => {
        const overrides = services();
        await renderWithServices(<CourseHomeworkTab cid="1" />, overrides);

        await fireEvent.press(await screen.findByText('下載附件'));

        await waitFor(() =>
            expect(mockNativeModule.previewFile).toHaveBeenCalledTimes(1),
        );
        expect(
            overrides.schoolPortal.proxy.downloadHandoff,
        ).toHaveBeenCalledWith(NOTICE_URL);
        const request = mockNativeModule.download.mock.calls[0][0];
        expect(request.url).toBe(NOTICE_URL);
        expect(request.fileName).toBe('作業1.pdf');
        expect(request.headers).toEqual({ 'user-agent': 'UA', accept: '*/*' });
        expect(request.cookies).toEqual([
            {
                name: 'ASP.NET_SessionId',
                value: 'abc',
                domain: 'noustud.nou.edu.tw',
                path: '/',
            },
        ]);
        expect(mockNativeModule.previewFile.mock.calls[0][0]).toContain(
            'attachments/',
        );
        expect(screen.queryByText('無法開啟附件')).toBeNull();
    });

    it('shows progress while downloading', async () => {
        let finish: (value: DownloadResult) => void = () => undefined;
        mockNativeModule.download.mockImplementationOnce(
            () => new Promise<DownloadResult>((resolve) => (finish = resolve)),
        );
        await renderWithServices(<CourseHomeworkTab cid="1" />, services());

        await fireEvent.press(await screen.findByText('下載附件'));
        expect(await screen.findByText('下載中...')).toBeTruthy();

        await waitFor(() =>
            expect(mockNativeModule.download).toHaveBeenCalled(),
        );
        const { id } = mockNativeModule.download.mock.calls[0][0];
        await act(async () => {
            mockNativeModule.emitDownloadProgress({
                id,
                bytesWritten: 50,
                totalBytes: 200,
            });
        });
        expect(await screen.findByText('25%')).toBeTruthy();

        await act(async () => {
            finish({
                uri: 'file:///cache/a.pdf',
                mimeType: 'application/pdf',
                size: 200,
                fileName: 'a.pdf',
            });
        });
        await waitFor(() => expect(screen.queryByText('下載中...')).toBeNull());
    });

    it('offers to save the file when no app can open it', async () => {
        mockNativeModule.previewFile.mockRejectedValueOnce(
            createAttachmentBridgeError('ERR_NO_VIEWER', '沒有可開啟的 App'),
        );
        await renderWithServices(<CourseHomeworkTab cid="1" />, services());

        await fireEvent.press(await screen.findByText('下載附件'));
        expect(await screen.findByText('無法開啟附件')).toBeTruthy();

        await fireEvent.press(screen.getByText('儲存'));

        await waitFor(() =>
            expect(mockNativeModule.saveFile).toHaveBeenCalledTimes(1),
        );
        const [uri, fileName] = mockNativeModule.saveFile.mock.calls[0];
        expect(uri).toContain('attachments/');
        expect(fileName).toBe('作業1.pdf');
        await waitFor(() =>
            expect(screen.queryByText('無法開啟附件')).toBeNull(),
        );
    });

    it('shows the failure message under the notice', async () => {
        mockNativeModule.download.mockRejectedValueOnce(
            createAttachmentBridgeError(
                'ERR_HTTP_STATUS',
                '下載失敗，HTTP 狀態碼：404',
            ),
        );
        await renderWithServices(<CourseHomeworkTab cid="1" />, services());

        await fireEvent.press(await screen.findByText('下載附件'));

        expect(
            await screen.findByText('下載失敗，HTTP 狀態碼：404'),
        ).toBeTruthy();
        expect(mockNativeModule.previewFile).not.toHaveBeenCalled();
    });

    it('opens homework pages in the in-app browser with the homework css', async () => {
        const onOpened = jest.fn();
        await renderWithServices(
            <CourseHomeworkTab cid="1" onOpenedInAppBrowser={onOpened} />,
            services(),
        );

        await fireEvent.press(await screen.findByText('進行作業'));

        expect(openInAppBrowser).toHaveBeenCalledWith(
            'https://uu.nou.edu.tw/hw/do',
            {
                cssPreset: 'homework',
            },
        );
        expect(onOpened).toHaveBeenCalled();
    });
});
