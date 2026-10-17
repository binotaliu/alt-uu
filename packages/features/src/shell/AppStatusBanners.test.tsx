import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppStatusBannersView } from './AppStatusBanners';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const metrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const renderBanners = (
    props: Partial<Parameters<typeof AppStatusBannersView>[0]> = {},
) => {
    const handlers = {
        onDismiss: jest.fn(),
        onOpenStore: jest.fn(),
        onOpenAnnouncement: jest.fn(),
    };

    return render(
        <SafeAreaProvider initialMetrics={metrics}>
            <AppStatusBannersView
                update={null}
                announcements={[]}
                {...handlers}
                {...props}
            />
        </SafeAreaProvider>,
    ).then(() => handlers);
};

describe('AppStatusBannersView', () => {
    it('renders nothing without update or announcements', async () => {
        await renderBanners();

        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('shows an optional update that can be dismissed and opened', async () => {
        const handlers = await renderBanners({
            update: {
                dismissKey: 'update:2.0.0',
                latestVersion: '2.0.0',
                storeUrl: 'https://store.example/app',
                required: false,
            },
        });

        expect(screen.getByText('有新版本可用')).toBeTruthy();
        await fireEvent.press(screen.getByText('前往更新'));
        expect(handlers.onOpenStore).toHaveBeenCalledWith(
            'https://store.example/app',
        );
        await fireEvent.press(screen.getByLabelText('關閉'));
        expect(handlers.onDismiss).toHaveBeenCalledWith('update:2.0.0');
    });

    it('cannot dismiss a required update', async () => {
        await renderBanners({
            update: {
                dismissKey: 'update:2.0.0',
                latestVersion: '2.0.0',
                storeUrl: null,
                required: true,
            },
        });

        expect(screen.getByText('請更新至最新版本')).toBeTruthy();
        expect(screen.queryByLabelText('關閉')).toBeNull();
    });

    it('renders announcements with link and dismiss control', async () => {
        const handlers = await renderBanners({
            announcements: [
                {
                    dismissKey: 'announcement:a',
                    severity: 'warning',
                    title: '維護公告',
                    body: '今晚維護',
                    url: 'https://example.com/more',
                    dismissible: true,
                },
                {
                    dismissKey: 'announcement:b',
                    severity: 'critical',
                    title: '不可關閉',
                    body: '',
                    url: null,
                    dismissible: false,
                },
            ],
        });

        expect(screen.getByText('維護公告')).toBeTruthy();
        expect(screen.getAllByLabelText('關閉')).toHaveLength(1);
        await fireEvent.press(screen.getByText('了解更多'));
        expect(handlers.onOpenAnnouncement).toHaveBeenCalledWith(
            'https://example.com/more',
        );
    });
});
