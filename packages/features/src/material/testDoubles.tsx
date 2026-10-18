/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Jest doubles for the native modules of the material page. Use from a test
 * file's `jest.mock` factory, e.g.
 * `jest.mock('expo-video', () => require('./testDoubles').expoVideoModule)`.
 */

type Listener = (payload: unknown) => void;

/** A minimal stand-in for expo-video's `VideoPlayer` shared object. */
export class FakeVideoPlayer {
  currentTime = 0;
  duration = 600;
  playbackRate = 1;
  playing = false;
  timeUpdateEventInterval = 0;
  showNowPlayingNotification = false;
  staysActiveInBackground = false;
  status = 'readyToPlay';
  source: unknown;
  replaceAsync = jest.fn(async (source: unknown) => {
    this.source = source;
  });
  generateThumbnailsAsync = jest.fn(async (times: number[]) => [
    {
      width: 1280,
      height: 720,
      requestedTime: times[0],
      actualTime: times[0],
    },
  ]);
  private listeners = new Map<string, Set<Listener>>();

  constructor(source: unknown) {
    this.source = source;
  }

  play = jest.fn(() => {
    this.playing = true;
    this.emit('playingChange', { isPlaying: true });
  });

  pause = jest.fn(() => {
    this.playing = false;
    this.emit('playingChange', { isPlaying: false });
  });

  addListener(event: string, listener: Listener) {
    const set = this.listeners.get(event) ?? new Set<Listener>();

    set.add(listener);
    this.listeners.set(event, set);

    return { remove: () => set.delete(listener) };
  }

  removeListener(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, payload: unknown = {}) {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }
}

export const createdPlayers: FakeVideoPlayer[] = [];

export const expoVideoModule = {
  useVideoPlayer: (
    source: unknown,
    setup?: (player: FakeVideoPlayer) => void,
  ) => {
    const React = require('react') as typeof import('react');
    const [player] = React.useState(() => {
      const created = new FakeVideoPlayer(source);

      setup?.(created);
      createdPlayers.push(created);

      return created;
    });

    return player;
  },
  VideoView: (props: Record<string, unknown>) => {
    const { View } = require('react-native');

    return <View testID="video-view" {...props} />;
  },
  VideoAirPlayButton: () => null,
};

export const webViewInstances: Array<{
  props: Record<string, unknown>;
  injectJavaScript: jest.Mock;
}> = [];

export const webViewModule = (() => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native');
  const WebView = React.forwardRef(function FakeWebView(
    props: Record<string, unknown>,
    ref: React.Ref<unknown>,
  ) {
    const [api] = React.useState(() => ({
      props,
      injectJavaScript: jest.fn(),
      reload: jest.fn(),
    }));

    api.props = props;
    React.useImperativeHandle(ref, () => api);
    React.useEffect(() => {
      webViewInstances.push(api);
    }, [api]);

    return <View testID="webview" />;
  });

  return { __esModule: true, default: WebView, WebView };
})();

export const expoNetworkModule = {
  NetworkStateType: { CELLULAR: 'CELLULAR', WIFI: 'WIFI' },
  getNetworkStateAsync: jest.fn(async () => ({
    type: 'WIFI',
    isConnected: true,
  })),
};

export const passthroughModules = {
  expoImage: {
    Image: () => {
      const { View } = require('react-native');

      return <View testID="frame-image" />;
    },
  },
  viewShot: { captureRef: jest.fn(async () => 'file:///tmp/capture.jpg') },
  sharing: {
    isAvailableAsync: jest.fn(async () => true),
    shareAsync: jest.fn(async () => undefined),
  },
  orientation: { unlockAsync: jest.fn(async () => undefined) },
};
