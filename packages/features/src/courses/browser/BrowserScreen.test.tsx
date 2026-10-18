import {
    mockNativeModule,
    resetAttachmentBridgeMock,
} from '@altuu/attachment-bridge/mock';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { renderWithServices } from '../testUtils';
import { BrowserScreen, isDownloadUrl } from './BrowserScreen';

interface CapturedWebViewProps {
    source: { uri: string } & Record<string, unknown>;
    injectedJavaScriptBeforeContentLoaded: string;
    sharedCookiesEnabled?: unknown;
    incognito?: unknown;
    cacheEnabled?: unknown;
    onNavigationStateChange: (event: object) => void;
    onLoadProgress: (event: object) => void;
    onShouldStartLoadWithRequest: (event: object) => boolean;
    onOpenWindow: (event: object) => void;
    onFileDownload: (event: object) => void;
    onError: (event: object) => void;
}

let mockParams: Record<string, string> = {};
const mockWebViewProps: { current: CapturedWebViewProps } = {
    current: {} as CapturedWebViewProps,
};
const mockWebViewApi = {
    goBack: jest.fn(),
    goForward: jest.fn(),
    injectJavaScript: jest.fn(),
};

jest.mock('@altuu/attachment-bridge', () =>
    jest.requireActual('@altuu/attachment-bridge/mock'),
);
jest.mock('expo-router', () => ({
    router: {
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
        canGoBack: () => true,
    },
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
        canGoBack: () => true,
    }),
    useLocalSearchParams: () => mockParams,
    usePathname: () => '/browser',
}));
jest.mock('react-native-webview', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { View } =
        jest.requireActual<typeof import('react-native')>('react-native');

    const WebView = React.forwardRef(function MockWebView(
        props: CapturedWebViewProps,
        ref: React.ForwardedRef<typeof mockWebViewApi>,
    ) {
        mockWebViewProps.current = props;
        React.useImperativeHandle(ref, () => mockWebViewApi);

        return React.createElement(View, { testID: 'webview' });
    });

    return { WebView, default: WebView };
});

const services = () => ({
    hungu: {
        client: {
            materialFetchHandoff: jest.fn(async () => ({
                url: 'about:blank',
                headers: {},
                baseUrl: 'https://uu.nou.edu.tw',
                cookies: { PHPSESSID: 'sess', empty: '' },
            })),
        },
    },
    schoolPortal: {
        proxy: {
            downloadHandoff: jest.fn(async (url: string) => ({
                url,
                headers: {},
                baseUrl: 'https://noustud.nou.edu.tw',
                cookies: { portal: 'p1' },
            })),
        },
    },
});

const loadedWebView = async () => {
    await waitFor(() => expect(screen.getByTestId('webview')).toBeTruthy());

    return mockWebViewProps.current;
};

beforeEach(() => {
    resetAttachmentBridgeMock();
    mockParams = {};
    mockWebViewProps.current = {} as CapturedWebViewProps;
    jest.clearAllMocks();
});

describe('BrowserScreen params', () => {
    it('shows a message instead of a WebView for a missing or non-http url', async () => {
        mockParams = { url: 'javascript:alert(1)' };
        await renderWithServices(<BrowserScreen />, services());

        expect(screen.getByText('無法在 App 內開啟此網址。')).toBeTruthy();
        expect(screen.queryByTestId('webview')).toBeNull();
    });

    it('seeds the HUNGU cookies before rendering the WebView', async () => {
        mockParams = { url: 'https://uu.nou.edu.tw/learn/hw.php' };
        await renderWithServices(<BrowserScreen />, services());

        const props = await loadedWebView();

        expect(mockNativeModule.setWebViewCookies).toHaveBeenCalledWith(
            'https://uu.nou.edu.tw',
            [
                {
                    name: 'PHPSESSID',
                    value: 'sess',
                    domain: 'uu.nou.edu.tw',
                    path: '/',
                },
            ],
        );
        expect(props.source).toEqual({
            uri: 'https://uu.nou.edu.tw/learn/hw.php',
        });
    });

    it('never sets the WebView props that disable the seeded cookie store', async () => {
        mockParams = { url: 'https://uu.nou.edu.tw/' };
        await renderWithServices(<BrowserScreen />, services());

        const props = await loadedWebView();

        expect(props.sharedCookiesEnabled).toBeUndefined();
        expect(props.incognito).toBeUndefined();
        expect(props.cacheEnabled).toBeUndefined();
    });

    it('still loads the page when there is no session', async () => {
        mockParams = { url: 'https://example.com/' };
        const overrides = services();
        overrides.hungu.client.materialFetchHandoff.mockRejectedValue(
            new Error('no session'),
        );
        await renderWithServices(<BrowserScreen />, overrides);

        const props = await loadedWebView();

        expect(mockNativeModule.setWebViewCookies).not.toHaveBeenCalled();
        expect(props.source.uri).toBe('https://example.com/');
    });

    it('posts the form urlencoded and injects the homework css', async () => {
        mockParams = {
            url: 'https://uu.nou.edu.tw/post',
            method: 'POST',
            postForm: JSON.stringify({ b: '2 3', a: '1' }),
            css: 'homework',
        };
        await renderWithServices(<BrowserScreen />, services());

        const props = await loadedWebView();

        expect(props.source).toEqual({
            uri: 'https://uu.nou.edu.tw/post',
            method: 'POST',
            headers: {
                'Content-Type':
                    'application/x-www-form-urlencoded; charset=utf-8',
            },
            body: 'a=1&b=2+3',
        });
        expect(props.injectedJavaScriptBeforeContentLoaded).toContain(
            'width=device-width, initial-scale=1',
        );
        expect(props.injectedJavaScriptBeforeContentLoaded).toContain(
            '__altuu_attachment_css__',
        );
    });
});

describe('BrowserScreen chrome and navigation', () => {
    const open = async () => {
        mockParams = { url: 'https://uu.nou.edu.tw/page' };
        await renderWithServices(<BrowserScreen />, services());

        return loadedWebView();
    };

    it('shows the page title, progress and drives back / forward', async () => {
        const props = await open();

        expect(screen.getByText('App 內瀏覽器')).toBeTruthy();
        await act(async () => {
            props.onNavigationStateChange({
                url: 'https://uu.nou.edu.tw/page2',
                title: '作業頁面',
                canGoBack: true,
                canGoForward: true,
                loading: false,
            });
            props.onLoadProgress({ nativeEvent: { progress: 0.4 } });
        });

        expect(screen.getByText('作業頁面')).toBeTruthy();
        expect(screen.getByRole('progressbar')).toBeTruthy();

        await fireEvent.press(screen.getByLabelText('上一頁'));
        await fireEvent.press(screen.getByLabelText('下一頁'));
        expect(mockWebViewApi.goBack).toHaveBeenCalled();
        expect(mockWebViewApi.goForward).toHaveBeenCalled();
    });

    it('hands tronclass:// links to the system and blocks the navigation', async () => {
        const openURL = jest
            .spyOn(Linking, 'openURL')
            .mockResolvedValue(undefined);
        const props = await open();

        const allowed = props.onShouldStartLoadWithRequest({
            url: 'tronclass://course/1',
            isTopFrame: true,
            navigationType: 'click',
        });

        expect(allowed).toBe(false);
        expect(openURL).toHaveBeenCalledWith('tronclass://course/1');
        expect(
            props.onShouldStartLoadWithRequest({
                url: 'https://uu.nou.edu.tw/next',
                isTopFrame: true,
                navigationType: 'click',
            }),
        ).toBe(true);
    });

    it('opens window.open / _blank targets in the same WebView', async () => {
        const props = await open();

        props.onOpenWindow({
            nativeEvent: { targetUrl: 'https://uu.nou.edu.tw/blank' },
        });

        expect(mockWebViewApi.injectJavaScript).toHaveBeenCalledWith(
            'window.location.href = "https://uu.nou.edu.tw/blank"; true;',
        );
    });

    it('downloads in-page files through the bridge with session cookies', async () => {
        const props = await open();

        await act(async () => {
            props.onFileDownload({
                nativeEvent: {
                    downloadUrl: 'https://uu.nou.edu.tw/files/a%20b.pdf',
                },
            });
        });

        await waitFor(() =>
            expect(mockNativeModule.previewFile).toHaveBeenCalled(),
        );
        const request = mockNativeModule.download.mock.calls[0][0];
        expect(request.url).toBe('https://uu.nou.edu.tw/files/a%20b.pdf');
        expect(request.fileName).toBe('a b.pdf');
        expect(request.headers).toEqual({
            Referer: 'https://uu.nou.edu.tw/page',
        });
        expect(request.cookies.map((cookie) => cookie.name)).toEqual([
            'PHPSESSID',
            'portal',
        ]);
    });

    it('shows a retry panel when the page fails to load', async () => {
        const props = await open();

        await act(async () => {
            props.onError({
                nativeEvent: { description: 'net::ERR_INTERNET_DISCONNECTED' },
            });
        });

        expect(screen.getByText('載入失敗')).toBeTruthy();
        expect(screen.getByText('net::ERR_INTERNET_DISCONNECTED')).toBeTruthy();
    });
});

describe('isDownloadUrl', () => {
    it('spots document links', () => {
        expect(isDownloadUrl('https://x.test/a/b.PDF')).toBe(true);
        expect(isDownloadUrl('https://x.test/a/b.docx?x=1')).toBe(true);
        expect(isDownloadUrl('https://x.test/a/page.php?id=1')).toBe(false);
    });
});
