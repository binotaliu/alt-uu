/* global jest */
/* Shared test doubles for modules that need a native / router runtime. */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
  usePathname: () => '/',
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));
jest.mock('expo-router/ui', () => ({
  Tabs: ({ children }) => children,
  TabList: ({ children }) => children,
  TabSlot: () => null,
  TabTrigger: ({ children }) => children,
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
require('react-native-gesture-handler/jestSetup');
jest.mock('react-native-worklets', () =>
  require('react-native-worklets/lib/module/mock'),
);
/* The package mock still boots the native CSS bridge, so use a minimal one. */
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const identity = (value) => value;
  const timing = (value, _config, callback) => {
    callback?.(true);
    return value;
  };

  return {
    __esModule: true,
    default: { View, createAnimatedComponent: identity },
    Easing: { out: identity, in: identity, cubic: identity },
    interpolate: (value, input, output) =>
      value <= input[0] ? output[0] : output[1],
    useSharedValue: (initial) =>
      require('react').useRef({
        value: initial,
        get() {
          return this.value;
        },
        set(next) {
          this.value = next;
        },
      }).current,
    useAnimatedStyle: (factory) => factory(),
    withTiming: timing,
    withSpring: identity,
    isSharedValue: () => false,
  };
});
