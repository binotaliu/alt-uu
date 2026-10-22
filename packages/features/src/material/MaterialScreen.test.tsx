/* eslint-disable @typescript-eslint/no-require-imports */
import {
  UserFacingHttpError,
  type CourseMaterialNode,
  type ParsedMaterialContent,
} from '@altuu/core';
import {
  createAttachmentBridgeError,
  mockNativeModule,
  resetAttachmentBridgeMock,
} from '@altuu/attachment-bridge/mock';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { DuoLayoutContext, NOT_FOLDABLE, type DuoLayout } from '@altuu/ui';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppServicesProvider } from '../services/AppServicesProvider';
import { useClientConfigStore, useToastStore } from '../services/stores';
import {
  createFakeServices,
  createTestQueryClient,
  resetStores,
} from '../testing/fakeServices';
import { MaterialScreen } from './MaterialScreen';
import { usePlaybackRateStore } from './player/PlaybackRateMenu';
import {
  createdPlayers,
  expoNetworkModule,
  webViewInstances,
} from './testDoubles';

jest.mock('@altuu/attachment-bridge', () =>
  require('@altuu/attachment-bridge/mock'),
);
jest.mock('expo-video', () => require('./testDoubles').expoVideoModule);
jest.mock('react-native-webview', () => require('./testDoubles').webViewModule);
jest.mock('expo-network', () => require('./testDoubles').expoNetworkModule);
jest.mock(
  'expo-image',
  () => require('./testDoubles').passthroughModules.expoImage,
);
jest.mock(
  'react-native-view-shot',
  () => require('./testDoubles').passthroughModules.viewShot,
);
jest.mock(
  'expo-sharing',
  () => require('./testDoubles').passthroughModules.sharing,
);
jest.mock(
  'expo-screen-orientation',
  () => require('./testDoubles').passthroughModules.orientation,
);
const mockBeforeRemoveListeners: Array<() => void> = [];
const mockSetOptions = jest.fn();
const mockNavigation = {
  setOptions: mockSetOptions,
  addListener: (_event: string, listener: () => void) => {
    mockBeforeRemoveListeners.push(listener);

    return () => undefined;
  },
};

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    setParams: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
  useNavigation: () => mockNavigation,
}));

const HUNGU = 'https://uu.nou.edu.tw';

function node(identifier: string, text: string): CourseMaterialNode {
  return {
    identifier,
    href: `${HUNGU}/base/${identifier}.htm`,
    text,
    readed: false,
    level: 2,
    leaf: true,
    itemDisabled: false,
  };
}

function content(
  overrides: Partial<ParsedMaterialContent> = {},
): ParsedMaterialContent {
  return {
    videoUrl: null,
    subtitleUrl: null,
    downloadUrl: null,
    downloadProxyUrl: null,
    downloadFileName: null,
    downloadFileExtension: null,
    isPdf: false,
    htmlContent: null,
    videoProvider: 'native',
    embedVideoUrl: null,
    baseUrl: null,
    download: null,
    subtitle: null,
    ...overrides,
  };
}

const nodes = [
  node('html', '第一章 導讀'),
  node('video', '第二章 影片'),
  node('pdf', '第三章 講義'),
];

const contents: Record<string, ParsedMaterialContent> = {
  html: content({
    htmlContent: '<p>教材內容</p>',
    baseUrl: `${HUNGU}/base/html.htm`,
  }),
  video: content({ videoUrl: 'https://media.example/v.mp4' }),
  pdf: content({
    isPdf: true,
    downloadUrl: `${HUNGU}/base/ch3.pdf`,
    downloadFileName: 'ch3.pdf',
    download: { url: `${HUNGU}/base/ch3.pdf`, headers: {} },
  }),
};

function setup(
  options: {
    courseType?: string;
    progressSeconds?: number;
    contentError?: boolean;
    plus?: boolean;
  } = {},
) {
  const fake = createFakeServices({ activeAccountId: 1 });
  const record = jest.fn(async () => ({
    ok: true,
    seconds: 10,
    message: null,
  }));
  const prepareMaterialFetch = jest.fn(async (url: string) => ({
    url,
    headers: { 'User-Agent': 'UA', Cookie: 'PHPSESSID=s1' },
  }));
  const getNodeContent = jest.fn(async (_cid: string, scoid: string) => {
    if (options.contentError) {
      throw new UserFacingHttpError(500, '教材壞了');
    }

    return contents[scoid] ?? content();
  });
  const services = fake.services as unknown as Record<string, unknown>;

  services.course = {
    listCourses: async () => [
      {
        courseId: 'C1',
        commonCourseId: null,
        semester: null,
        name: '心理學',
        className: null,
        courseType: options.courseType ?? '影音',
      },
    ],
    getCoursePath: async () => ({
      pathInfo: {},
      materialNodes: nodes,
    }),
    getNodeContent,
    getNodeResources: async () => [],
    getParsedMaterialContent: jest.fn(),
    getPlaybackProgress: async (cid: string, activityId: string) => ({
      progress:
        options.progressSeconds === undefined
          ? null
          : {
              cid,
              activityId,
              studySeconds: 100,
              positionSeconds: options.progressSeconds,
              mediaDurationSeconds: 600,
              hunguUploadSuccess: true,
              updatedAt: null,
            },
    }),
    prepareMaterialFetch,
  };
  services.studyTime = { record };
  services.materialPreference = {
    getFontScale: async () => ({ scale: 1 }),
    setFontScale: jest.fn(async (scale: number) => ({ scale })),
  };
  (services.storage as Record<string, unknown>).hunguSessions = {
    get: async () => ({
      baseUrl: HUNGU,
      userAgent: 'UA',
      cookies: { PHPSESSID: 's1', idx: '9' },
    }),
  };
  (services.storage as Record<string, unknown>).keyValues = {
    get: async () => null,
    set: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
  };

  services.subscription = {
    getCachedEntitlement: async () => ({
      active: options.plus ?? false,
      productId: null,
      expiresAt: null,
      platform: null,
    }),
    getEntitlementStatus: async () => ({
      active: options.plus ?? false,
      productId: null,
      expiresAt: null,
      platform: null,
    }),
  };

  const queryClient = createTestQueryClient();

  const screenTree = (scoid: string, layout: DuoLayout = NOT_FOLDABLE) => (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <AppServicesProvider
        services={fake.services}
        queryClient={queryClient}
        router={{ push: jest.fn(), replace: jest.fn() }}
      >
        <DuoLayoutContext.Provider value={layout}>
          <MaterialScreen cid="C1" scoid={scoid} />
        </DuoLayoutContext.Provider>
      </AppServicesProvider>
    </SafeAreaProvider>
  );

  return {
    ...fake,
    record,
    getNodeContent,
    prepareMaterialFetch,
    screenTree,
    renderScreen: (scoid: string, layout: DuoLayout = NOT_FOLDABLE) =>
      render(screenTree(scoid, layout)),
  };
}

beforeEach(() => {
  resetStores();
  resetAttachmentBridgeMock();
  createdPlayers.length = 0;
  webViewInstances.length = 0;
  usePlaybackRateStore.setState({ rate: 1 });
  expoNetworkModule.getNetworkStateAsync.mockResolvedValue({
    type: 'WIFI',
    isConnected: true,
  });
  jest.mocked(router.replace).mockClear();
  jest.mocked(router.back).mockClear();
  jest.mocked(router.setParams).mockClear();
});

describe('MaterialScreen', () => {
  it('renders HTML material after seeding the HUNGU cookies', async () => {
    const { renderScreen } = setup();

    await renderScreen('html');

    await waitFor(() => expect(screen.getByTestId('webview')).toBeTruthy(), {
      timeout: 5000,
    });
    expect(screen.getByText('心理學')).toBeTruthy();
    expect(screen.getByText('第一章 導讀')).toBeTruthy();
    expect(mockNativeModule.setWebViewCookies).toHaveBeenCalledWith(
      `${HUNGU}/base/html.htm`,
      [
        { name: 'PHPSESSID', value: 's1' },
        { name: 'idx', value: '9' },
      ],
    );
    const webView = webViewInstances.at(-1);
    const source = webView?.props.source as {
      html: string;
      baseUrl: string;
    };

    expect(source.baseUrl).toBe(`${HUNGU}/base/html.htm`);
    expect(source.html).toContain('<p>教材內容</p>');
    expect(webView?.props.sharedCookiesEnabled).toBeUndefined();
    expect(webView?.props.incognito).toBeUndefined();
    expect(screen.getByText('下一個教材')).toBeTruthy();
    expect(screen.getByText('第二章 影片')).toBeTruthy();
  });

  it('shows the error panel and retries', async () => {
    const { renderScreen, getNodeContent } = setup({ contentError: true });

    await renderScreen('html');

    await waitFor(() => expect(screen.getByText(/教材壞了/)).toBeTruthy(), {
      timeout: 5000,
    });
    const calls = getNodeContent.mock.calls.length;

    await fireEvent.press(screen.getByText('重試'));
    await waitFor(() =>
      expect(getNodeContent.mock.calls.length).toBeGreaterThan(calls),
    );
  });

  it('offers to resume from the saved position and seeks there', async () => {
    const { renderScreen } = setup({ progressSeconds: 125 });

    await renderScreen('video');

    await waitFor(() =>
      expect(screen.getByText('接續上次播放？')).toBeTruthy(),
    );
    expect(screen.getByText('2 分 05 秒')).toBeTruthy();
    const player = createdPlayers.at(-1);

    expect(player?.showNowPlayingNotification).toBe(true);
    expect(player?.staysActiveInBackground).toBe(true);
    expect(player?.source).toMatchObject({
      uri: 'https://media.example/v.mp4',
      metadata: { title: '第二章 影片', artist: '心理學' },
    });

    await fireEvent.press(screen.getByText('接續播放'));

    expect(player?.currentTime).toBe(125);
    expect(screen.queryByText('接續上次播放？')).toBeNull();
  });

  it('does not offer to resume short positions', async () => {
    const { renderScreen } = setup({ progressSeconds: 2 });

    await renderScreen('video');

    await waitFor(() => expect(createdPlayers.length).toBe(1));
    expect(screen.queryByText('接續上次播放？')).toBeNull();
  });

  it('asks before playing on cellular and leaves when declined', async () => {
    useClientConfigStore.setState((state) => ({
      preferences: {
        ...state.preferences,
        cellularPlaybackWarningEnabled: true,
      },
    }));
    expoNetworkModule.getNetworkStateAsync.mockResolvedValue({
      type: 'CELLULAR',
      isConnected: true,
    });
    const { renderScreen } = setup();

    await renderScreen('video');

    await waitFor(() =>
      expect(screen.getByText('使用行動網路播放？')).toBeTruthy(),
    );
    expect(createdPlayers).toHaveLength(0);

    await fireEvent.press(screen.getByText('返回課程'));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/courses/C1'),
    );
    expect(createdPlayers).toHaveLength(0);
  });

  it('plays on cellular after confirmation', async () => {
    expoNetworkModule.getNetworkStateAsync.mockResolvedValue({
      type: 'CELLULAR',
      isConnected: true,
    });
    const { renderScreen } = setup();

    await renderScreen('video');
    await waitFor(() =>
      expect(screen.getByText('使用行動網路播放？')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByText('繼續播放'));

    await waitFor(() => expect(createdPlayers).toHaveLength(1));
  });

  it('changes the video speed from the rate menu', async () => {
    const { renderScreen } = setup();

    await renderScreen('video');
    await waitFor(() => expect(createdPlayers).toHaveLength(1));

    await fireEvent.press(screen.getByLabelText('播放速度 1x'));
    await fireEvent.press(screen.getByText('1.5x'));

    expect(createdPlayers[0]?.playbackRate).toBe(1.5);
    expect(usePlaybackRateStore.getState().rate).toBe(1.5);
  });

  describe('on a half-folded iPhone Duo in portrait', () => {
    const laptopFold: DuoLayout = {
      isFoldable: true,
      display: 'inner',
      foldFrame: { x: 0, y: 450, width: 700, height: 12 },
      foldAxis: 'horizontal',
      sideBar: false,
      barEdge: 'right',
      barWidth: 0,
      barClearance: { top: 0, bottom: 0 },
    };

    it('shows the seek bar and controls below the fold', async () => {
      const { renderScreen } = setup();

      await renderScreen('video', laptopFold);
      await waitFor(() =>
        expect(screen.getByTestId('video-view')).toBeTruthy(),
      );

      expect(screen.getByTestId('video-control-bar')).toBeTruthy();
      expect(screen.getByTestId('fold-split-first')).toBeTruthy();

      const player = createdPlayers[0];

      await fireEvent.press(screen.getByLabelText('快轉 10 秒'));
      expect(player?.currentTime).toBe(10);

      await fireEvent.press(await screen.findByLabelText('暫停'));
      expect(player?.playing).toBe(false);
    });

    it('turns the swipe-back gesture off while the seek bar is shown', async () => {
      mockSetOptions.mockClear();
      const { renderScreen } = setup();

      await renderScreen('video', laptopFold);
      await waitFor(() =>
        expect(mockSetOptions).toHaveBeenCalledWith({ gestureEnabled: false }),
      );
    });

    it('keeps the same playing player across a fold', async () => {
      const { screenTree } = setup();
      const view = await render(screenTree('video'));

      await waitFor(() => expect(createdPlayers).toHaveLength(1));

      const player = createdPlayers[0];

      if (player === undefined) {
        throw new Error('no player');
      }

      player.currentTime = 42;

      await view.rerender(screenTree('video', laptopFold));
      await waitFor(() =>
        expect(screen.getByTestId('video-control-bar')).toBeTruthy(),
      );
      await view.rerender(screenTree('video'));
      await waitFor(() =>
        expect(screen.queryByTestId('video-control-bar')).toBeNull(),
      );

      expect(createdPlayers).toHaveLength(1);
      expect(player.currentTime).toBe(42);
      expect(player.playing).toBe(true);
    });

    it('keeps the normal layout when the device is not folded', async () => {
      const { renderScreen } = setup();

      await renderScreen('video', { ...laptopFold, foldFrame: null });
      await waitFor(() => expect(createdPlayers).toHaveLength(1));

      expect(screen.queryByTestId('video-control-bar')).toBeNull();
    });
  });

  it('shows the audio controls for 語音 courses', async () => {
    const { renderScreen } = setup({ courseType: '語音' });

    await renderScreen('video');

    await waitFor(() =>
      expect(screen.getByLabelText('快轉 10 秒')).toBeTruthy(),
    );
    expect(screen.queryByTestId('video-view')).toBeNull();
    expect(screen.queryByLabelText('截取畫面')).toBeNull();
    const player = createdPlayers[0];

    await fireEvent.press(screen.getByLabelText('快轉 10 秒'));
    expect(player?.currentTime).toBe(10);
  });

  it('reports the study time when going back', async () => {
    const { renderScreen, record } = setup();
    let now = Date.parse('2026-10-18T02:00:00.000Z');
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => now);

    try {
      await renderScreen('html');
      await waitFor(() => expect(screen.getByTestId('webview')).toBeTruthy());

      now += 42_000;
      await fireEvent.press(screen.getByLabelText('返回'));

      await waitFor(() => expect(router.back).toHaveBeenCalled());
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          cid: 'C1',
          activityId: 'html',
          url: `${HUNGU}/base/html.htm`,
          seconds: 42,
        }),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('reports the study time when leaving without the back button', async () => {
    const { renderScreen, record } = setup();
    let now = Date.parse('2026-10-18T02:00:00.000Z');
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => now);

    try {
      await renderScreen('html');
      await waitFor(() => expect(screen.getByTestId('webview')).toBeTruthy());

      now += 30_000;
      mockBeforeRemoveListeners.forEach((listener) => listener());

      await waitFor(() =>
        expect(record).toHaveBeenCalledWith(
          expect.objectContaining({ activityId: 'html', seconds: 30 }),
        ),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('saves the visit before moving to the next material', async () => {
    const { renderScreen, record, getNodeContent } = setup();
    let now = Date.parse('2026-10-18T02:00:00.000Z');
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => now);

    try {
      await renderScreen('html');
      await waitFor(() => expect(screen.getByTestId('webview')).toBeTruthy());

      now += 5_000;
      await fireEvent.press(screen.getByText('第二章 影片'));

      await waitFor(() =>
        expect(router.setParams).toHaveBeenCalledWith({
          scoid: 'video',
        }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ activityId: 'html', seconds: 5 }),
      );
      await waitFor(() =>
        expect(getNodeContent).toHaveBeenCalledWith('C1', 'video'),
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe('MaterialScreen landscape directory', () => {
  const dimensions =
    jest.requireActual<typeof import('react-native')>(
      'react-native',
    ).Dimensions;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the directory sheet from 切換教材 on a phone in landscape', async () => {
    jest
      .spyOn(dimensions, 'get')
      .mockReturnValue({ width: 700, height: 360, scale: 3, fontScale: 1 });
    const { renderScreen } = setup();

    await renderScreen('html');
    await waitFor(() => expect(screen.getByTestId('webview')).toBeTruthy());

    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
    await fireEvent.press(screen.getByTestId('material-switch-button'));

    expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
  });

  it('splits directory and content around a vertical fold in landscape', async () => {
    jest
      .spyOn(dimensions, 'get')
      .mockReturnValue({ width: 700, height: 360, scale: 3, fontScale: 1 });
    const { renderScreen } = setup();

    await renderScreen('html', {
      isFoldable: true,
      display: 'inner',
      foldFrame: { x: 340, y: 0, width: 20, height: 360 },
      foldAxis: 'vertical',
      sideBar: true,
      barEdge: 'right',
      barWidth: 0,
      barClearance: { top: 0, bottom: 0 },
    });
    await waitFor(() => expect(screen.getByTestId('webview')).toBeTruthy());

    expect(screen.getByTestId('fold-split')).toBeTruthy();
    expect(screen.getByTestId('material-sidebar')).toBeTruthy();
    expect(screen.queryByTestId('material-switch-button')).toBeNull();
  });

  it('shows 切換教材 whenever the sidebar is hidden', async () => {
    const { renderScreen } = setup();

    await renderScreen('html');
    await waitFor(() => expect(screen.getByTestId('webview')).toBeTruthy());

    expect(screen.getByTestId('material-switch-button')).toBeTruthy();
  });
});

describe('MaterialScreen downloads', () => {
  it('downloads with the session cookies and previews the file', async () => {
    const { renderScreen, prepareMaterialFetch } = setup();

    await renderScreen('pdf');
    await waitFor(() => expect(screen.getByText('下載 PDF')).toBeTruthy());
    expect(
      screen.getByText(
        '本教材為 PDF 檔案，您可以下載後以其他 App 開啟或使用內建瀏覽器檢視。',
      ),
    ).toBeTruthy();

    await fireEvent.press(screen.getByText('下載 PDF'));

    await waitFor(() =>
      expect(mockNativeModule.previewFile).toHaveBeenCalled(),
    );
    expect(prepareMaterialFetch).toHaveBeenCalledWith(`${HUNGU}/base/ch3.pdf`, {
      cid: 'C1',
    });
    expect(mockNativeModule.download).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `${HUNGU}/base/ch3.pdf`,
        headers: { 'User-Agent': 'UA' },
        cookies: [
          {
            name: 'PHPSESSID',
            value: 's1',
            domain: 'uu.nou.edu.tw',
            path: '/',
          },
        ],
        fileName: 'ch3.pdf',
      }),
    );
    expect(mockNativeModule.saveFile).not.toHaveBeenCalled();
  });

  it('offers saving when no viewer can open the file', async () => {
    mockNativeModule.previewFile.mockRejectedValueOnce(
      createAttachmentBridgeError('ERR_NO_VIEWER', '沒有可開啟的 App'),
    );
    const { renderScreen } = setup();

    await renderScreen('pdf');
    await waitFor(() => expect(screen.getByText('下載 PDF')).toBeTruthy());
    await fireEvent.press(screen.getByText('下載 PDF'));

    await waitFor(() =>
      expect(mockNativeModule.saveFile).toHaveBeenCalledWith(
        expect.stringContaining('ch3.pdf'),
        'ch3.pdf',
        'application/octet-stream',
      ),
    );
  });

  it('shows download failures', async () => {
    mockNativeModule.download.mockRejectedValueOnce(
      createAttachmentBridgeError(
        'ERR_HTTP_STATUS',
        '下載失敗，HTTP 狀態碼：404',
      ),
    );
    const { renderScreen } = setup();

    await renderScreen('pdf');
    await waitFor(() => expect(screen.getByText('下載 PDF')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText('下載 PDF'));
    });

    await waitFor(() =>
      expect(screen.getByText('下載失敗，HTTP 狀態碼：404')).toBeTruthy(),
    );
  });

  it('retries a failed study-time save three times, then shows a toast', async () => {
    const { renderScreen, record } = setup();
    record.mockRejectedValue(new Error('offline'));
    let now = Date.parse('2026-10-18T02:00:00.000Z');
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => now);

    try {
      await renderScreen('html');
      await waitFor(() => expect(screen.getByTestId('webview')).toBeTruthy());

      now += 5_000;
      await fireEvent.press(screen.getByText('第二章 影片'));

      await waitFor(() => expect(record).toHaveBeenCalledTimes(4), {
        timeout: 5000,
      });
      await waitFor(() =>
        expect(useToastStore.getState().message).toBe(
          '學習進度儲存失敗，請稍後再試',
        ),
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe('MaterialScreen 沉浸式播放', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  /** The entitlement loads asynchronously; the badge disappears once it is active. */
  const toggleImmersive = async () => {
    await waitFor(() => expect(screen.queryByText('Alt UU+')).toBeNull());
    await fireEvent.press(screen.getByLabelText('沉浸式播放'));
  };

  it('sends non-subscribers to the subscription page', async () => {
    const { renderScreen } = setup();

    await renderScreen('html');
    await waitFor(() => expect(screen.getByTestId('webview')).toBeTruthy());
    expect(screen.getByText('Alt UU+')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('沉浸式播放'));

    expect(router.push).toHaveBeenCalledWith('/courses/account/subscription');
    expect(
      screen.getByLabelText('沉浸式播放').props.accessibilityState,
    ).toEqual(expect.objectContaining({ checked: false }));
  });

  it('moves on to the next material when the media ends', async () => {
    const { renderScreen } = setup({ plus: true });

    await renderScreen('video');
    await waitFor(() => expect(createdPlayers.length).toBe(1));
    await waitFor(() =>
      expect(
        screen.getByLabelText('沉浸式播放').props.accessibilityState,
      ).toBeTruthy(),
    );
    await toggleImmersive();

    await act(async () => {
      createdPlayers[0]?.emit('playToEnd');
    });

    await waitFor(() =>
      expect(router.setParams).toHaveBeenCalledWith({ scoid: 'pdf' }),
    );
  });

  it('counts down 30 seconds on materials without media, then moves on', async () => {
    const { renderScreen } = setup({ plus: true });

    await renderScreen('html');
    await waitFor(() => expect(screen.getByTestId('webview')).toBeTruthy());
    jest.useFakeTimers();
    await toggleImmersive();

    expect(screen.getByText('30 秒後自動切換至下一個教材')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('20 秒後自動切換至下一個教材')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    expect(router.setParams).toHaveBeenCalledWith({ scoid: 'video' });
  });

  it('stops the countdown from the toast', async () => {
    const { renderScreen } = setup({ plus: true });

    await renderScreen('html');
    await waitFor(() => expect(screen.getByTestId('webview')).toBeTruthy());
    await toggleImmersive();
    await fireEvent.press(await screen.findByText('停止沉浸式播放'));

    expect(screen.queryByTestId('immersive-countdown')).toBeNull();
  });

  it('does not offer to resume while immersive', async () => {
    const { renderScreen } = setup({ plus: true, progressSeconds: 125 });

    await renderScreen('html');
    await waitFor(() => expect(screen.getByTestId('webview')).toBeTruthy());
    await toggleImmersive();
    await fireEvent.press(await screen.findByText('立即切換'));

    await waitFor(() => expect(createdPlayers.length).toBe(1));
    expect(screen.queryByText('接續上次播放？')).toBeNull();
  });

  it('finishes after the last material', async () => {
    const { renderScreen } = setup({ plus: true });

    await renderScreen('pdf');
    await waitFor(() =>
      expect(screen.getByLabelText('沉浸式播放')).toBeTruthy(),
    );
    await toggleImmersive();
    await fireEvent.press(await screen.findByText('立即結束'));

    expect(useToastStore.getState().message).toBe('沉浸式播放已結束');
    expect(screen.queryByTestId('immersive-countdown')).toBeNull();
  });
});
