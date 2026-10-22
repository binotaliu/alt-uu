import { DuoLayoutContext, NOT_FOLDABLE, type DuoLayout } from '@altuu/ui';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useClientConfigStore } from '../services/stores';
import { resetStores } from '../testing/fakeServices';
import { CoursesTabs } from './CoursesTabs';

jest.mock('expo-router', () => ({ usePathname: () => '/courses' }));

// Headless tabs need a navigator; the tests only care how the shell lays the triggers out.
jest.mock('expo-router/ui', () => {
  const { View } = jest.requireActual('react-native');

  const passThrough = ({ children }: { children?: ReactNode }) => children;

  return {
    Tabs: View,
    TabList: passThrough,
    TabSlot: () => null,
    TabTrigger: passThrough,
  };
});

jest.mock('../services/AppServicesProvider', () => ({
  useServiceRuntime: () => ({ updatePreferences: jest.fn() }),
}));

const sideBarLayout: DuoLayout = {
  isFoldable: true,
  display: 'outer',
  foldFrame: null,
  foldAxis: null,
  sideBar: true,
};

async function renderTabs(layout: DuoLayout, width = 390) {
  const metrics = {
    frame: { x: 0, y: 0, width, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
  };

  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <DuoLayoutContext.Provider value={layout}>
        <CoursesTabs />
      </DuoLayoutContext.Provider>
    </SafeAreaProvider>,
  );
}

describe('CoursesTabs', () => {
  beforeEach(() => {
    resetStores();
  });

  it('draws a side rail of icon-only tabs on the iPhone Duo outer display', async () => {
    await renderTabs(sideBarLayout);

    expect(screen.getByTestId('tab-rail')).toBeTruthy();
    expect(screen.getByLabelText('我的課程')).toBeTruthy();
    expect(screen.queryByText('我的課程')).toBeNull();
  });

  it('keeps the bottom bar on a regular phone', async () => {
    await renderTabs(NOT_FOLDABLE);

    expect(screen.queryByTestId('tab-rail')).toBeNull();
    expect(screen.getByText('我的課程')).toBeTruthy();
  });

  it('keeps the top pills on a tablet', async () => {
    await renderTabs(NOT_FOLDABLE, 1024);

    expect(screen.queryByTestId('tab-rail')).toBeNull();
    expect(screen.getByText('我的課程')).toBeTruthy();
  });

  it('still asks to enable NOU Tools from a gated rail tab', async () => {
    useClientConfigStore.setState((state) => ({
      preferences: { ...state.preferences, nouToolsIntegrationEnabled: false },
    }));
    await renderTabs(sideBarLayout);

    await fireEvent.press(screen.getByTestId('tab-live-sessions'));

    expect(screen.getByText('開啟 NOU 小幫手整合')).toBeTruthy();
  });
});
