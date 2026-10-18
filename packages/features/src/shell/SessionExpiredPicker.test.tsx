import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppServicesProvider } from '../services/AppServicesProvider';
import { useSessionExpiryStore } from '../services/stores';
import {
  account,
  createFakeServices,
  createTestQueryClient,
  resetStores,
} from '../testing/fakeServices';
import { SessionExpiredPicker } from './SessionExpiredPicker';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

beforeEach(() => {
  resetStores();
  (router.push as jest.Mock).mockClear();
});

async function renderPicker(fake = createFakeServices()) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppServicesProvider
        services={fake.services}
        queryClient={createTestQueryClient()}
      >
        <SessionExpiredPicker />
      </AppServicesProvider>
    </SafeAreaProvider>,
  );

  return fake;
}

describe('SessionExpiredPicker', () => {
  it('stays hidden until the expiry flow opens it', async () => {
    await renderPicker();

    expect(screen.queryByText('登入已失效')).toBeNull();
  });

  it('lists the other accounts and offers re-login for the failed one', async () => {
    const fake = createFakeServices({
      accounts: [account(2, { nickname: '小明' }), account(3)],
    });
    await renderPicker(fake);

    await act(async () => {
      useSessionExpiryStore.getState().openPicker(1);
    });

    await waitFor(() => expect(screen.getByText('小明')).toBeTruthy());
    expect(screen.getByText('user3')).toBeTruthy();

    await fireEvent.press(screen.getByText('重新登入「目前帳號」'));

    expect(router.push).toHaveBeenCalledWith('/reauth/1');
    expect(useSessionExpiryStore.getState().pickerOpen).toBe(false);
  });

  it('switches account and closes the picker', async () => {
    const fake = createFakeServices({ accounts: [account(2)] });
    await renderPicker(fake);

    await act(async () => {
      useSessionExpiryStore.getState().openPicker(1);
    });
    await waitFor(() => expect(screen.getByText('user2')).toBeTruthy());

    await fireEvent.press(screen.getByText('user2'));

    await waitFor(() =>
      expect(useSessionExpiryStore.getState().pickerOpen).toBe(false),
    );
  });
});
