import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useSessionExpiryStore } from '../../services/stores';
import { account, resetStores } from '../../testing/fakeServices';
import { renderScreen, withServices } from '../testing';
import { ReauthScreen } from './ReauthScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ accountId: '7' }),
}));

beforeEach(() => {
  resetStores();
  (router.replace as jest.Mock).mockClear();
});

function reauthServices(
  reauthenticate: jest.Mock,
  accounts = [account(7, { nickname: '小明' })],
) {
  return withServices({
    account: { list: async () => accounts, reauthenticate },
  }).services;
}

describe('ReauthScreen', () => {
  it('names the account that needs the password', async () => {
    await renderScreen(<ReauthScreen />, reauthServices(jest.fn()));

    expect(await screen.findByText('小明')).toBeTruthy();
    expect(screen.getByText('重新登入', { exact: true })).toBeTruthy();
  });

  it('shows the message when the password is rejected', async () => {
    const reauthenticate = jest.fn(async () => ({
      ok: false as const,
      message: '登入失敗，請確認帳號密碼。',
    }));
    await renderScreen(<ReauthScreen />, reauthServices(reauthenticate));

    await fireEvent.changeText(
      screen.getByPlaceholderText('請輸入密碼'),
      'nope',
    );
    await fireEvent.press(screen.getByText('登入', { exact: true }));

    expect(await screen.findByText('登入失敗，請確認帳號密碼。')).toBeTruthy();
    expect(reauthenticate).toHaveBeenCalledWith(7, 'nope');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('returns to the page where the session expired', async () => {
    useSessionExpiryStore.getState().setReturnTo('/courses/c1');
    const reauthenticate = jest.fn(async () => ({
      ok: true as const,
      message: '' as const,
      accounts: [account(7)],
    }));
    await renderScreen(<ReauthScreen />, reauthServices(reauthenticate));

    await fireEvent.changeText(
      screen.getByPlaceholderText('請輸入密碼'),
      'secret',
    );
    await fireEvent.press(screen.getByText('登入', { exact: true }));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/courses/c1'),
    );
    expect(useSessionExpiryStore.getState().returnTo).toBeNull();
  });

  it('falls back to the course list without a return path', async () => {
    const reauthenticate = jest.fn(async () => ({
      ok: true as const,
      message: '' as const,
      accounts: [account(7)],
    }));
    await renderScreen(<ReauthScreen />, reauthServices(reauthenticate));

    await fireEvent.changeText(
      screen.getByPlaceholderText('請輸入密碼'),
      'secret',
    );
    await fireEvent.press(screen.getByText('登入', { exact: true }));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/courses'),
    );
  });
});
