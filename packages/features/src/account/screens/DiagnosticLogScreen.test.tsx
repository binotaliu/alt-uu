import type {
    DiagnosticEventViewModel,
    DiagnosticRecordingStatusViewModel,
} from '@altuu/core';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';

import { resetStores } from '../../testing/fakeServices';
import { renderScreen, withServices } from '../testing';
import { saveTextFile } from '../lib/files';
import { DiagnosticLogScreen } from './DiagnosticLogScreen';

jest.mock('../lib/files', () => ({ saveTextFile: jest.fn() }));

const save = saveTextFile as jest.Mock;

function event(
    id: number,
    overrides: Partial<DiagnosticEventViewModel> = {},
): DiagnosticEventViewModel {
    return {
        id,
        occurredAt: '2026-10-18T08:30:15.000Z',
        type: 'api.request',
        typeLabel: 'App 請求',
        level: 'info',
        source: 'client',
        op: 'courses.list',
        requestId: `req${id}`,
        summary: `載入課程 ${id}`,
        status: 200,
        durationMs: 120,
        context: {},
        ...overrides,
    };
}

const status: DiagnosticRecordingStatusViewModel = {
    available: true,
    recording: false,
    expiresAt: null,
    windowMinutes: 30,
    retentionDays: 14,
};

beforeEach(() => {
    resetStores();
    save.mockReset();
    (Clipboard.setStringAsync as jest.Mock).mockReset();
});

function setup(events: DiagnosticEventViewModel[]) {
    const listEvents = jest.fn(
        async (options: { problemsOnly?: boolean } = {}) => ({
            events: options.problemsOnly
                ? events.filter((item) => item.level !== 'info')
                : events,
            total: events.length,
            recordingEnabled: true,
        }),
    );
    const clearEvents = jest.fn(async () => undefined);
    const buildBundle = jest.fn(async () => ({
        filename: 'alt-uu-diagnostics-20261018.md',
        content: '# Alt UU 診斷記錄',
    }));
    const { services } = withServices({
        diagnostics: {
            listEvents,
            clearEvents,
            buildBundle,
            getRecordingStatus: async () => status,
            setRecording: async () => status,
        },
    });

    return { services, listEvents, clearEvents, buildBundle };
}

describe('DiagnosticLogScreen', () => {
    it('renders the logged events with their metadata', async () => {
        const { services } = setup([
            event(1),
            event(2, {
                level: 'error',
                summary: '載入教材失敗',
                status: 503,
                typeLabel: '外部服務呼叫',
            }),
        ]);
        await renderScreen(<DiagnosticLogScreen />, services);

        expect(await screen.findByText('載入課程 1')).toBeTruthy();
        expect(screen.getByText('載入教材失敗')).toBeTruthy();
        expect(screen.getByText('→ 503')).toBeTruthy();
        expect(screen.getByText('外部服務呼叫')).toBeTruthy();
        expect(screen.getByText('#req1')).toBeTruthy();
        expect(screen.getByText('✗')).toBeTruthy();
        expect(screen.getByText('顯示 2 筆，共 2 筆。')).toBeTruthy();
    });

    it('expands an event to show its context', async () => {
        const { services } = setup([
            event(1, { context: { errorName: 'TimeoutError' } }),
        ]);
        await renderScreen(<DiagnosticLogScreen />, services);

        await fireEvent.press(await screen.findByText('載入課程 1'));

        expect(screen.getByText(/"errorName": "TimeoutError"/)).toBeTruthy();
    });

    it('filters to problems only', async () => {
        const { services, listEvents } = setup([
            event(1),
            event(2, { level: 'warning', summary: '解析異常' }),
        ]);
        await renderScreen(<DiagnosticLogScreen />, services);
        await screen.findByText('載入課程 1');

        await fireEvent.press(screen.getByText('僅錯誤'));

        await waitFor(() =>
            expect(screen.queryByText('載入課程 1')).toBeNull(),
        );
        expect(screen.getByText('解析異常')).toBeTruthy();
        expect(listEvents).toHaveBeenLastCalledWith({ problemsOnly: true });
    });

    it('explains how to start recording when the log is empty', async () => {
        const { services } = setup([]);
        await renderScreen(<DiagnosticLogScreen />, services);

        expect(
            await screen.findByText(
                '目前沒有任何記錄。請先於上方開啟診斷記錄，再重現一次問題。',
            ),
        ).toBeTruthy();
    });

    it('copies the bundle to the clipboard', async () => {
        (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(true);
        const { services, buildBundle } = setup([event(1)]);
        await renderScreen(<DiagnosticLogScreen />, services);

        await fireEvent.press(await screen.findByText('複製'));

        await waitFor(() =>
            expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
                '# Alt UU 診斷記錄',
            ),
        );
        expect(buildBundle).toHaveBeenCalled();
        expect(await screen.findByText('已複製診斷記錄')).toBeTruthy();
    });

    it('shares the bundle as a markdown file', async () => {
        save.mockResolvedValue(true);
        const { services } = setup([event(1)]);
        await renderScreen(<DiagnosticLogScreen />, services);

        await fireEvent.press(await screen.findByText('分享'));

        await waitFor(() =>
            expect(save).toHaveBeenCalledWith(
                'alt-uu-diagnostics-20261018.md',
                '# Alt UU 診斷記錄',
                'text/markdown',
            ),
        );
        expect(await screen.findByText('已匯出診斷記錄')).toBeTruthy();
    });

    it('asks for confirmation before clearing the log', async () => {
        const { services, clearEvents } = setup([event(1)]);
        await renderScreen(<DiagnosticLogScreen />, services);

        await fireEvent.press(await screen.findByText('清除'));
        expect(clearEvents).not.toHaveBeenCalled();

        await fireEvent.press(screen.getAllByText('清除').at(-1)!);

        await waitFor(() => expect(clearEvents).toHaveBeenCalled());
    });
});
