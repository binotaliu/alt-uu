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
