import { assertCredentialsInput } from '@altuu/core';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { resetStores } from '../../testing/fakeServices';
import { renderScreen, withServices } from '../testing';
import { LoginScreen } from './LoginScreen';

beforeEach(() => {
  resetStores();
  (router.replace as jest.Mock).mockClear();
  (router.push as jest.Mock).mockClear();
});

function loginServices(
  login: (input: { username: string; password: string }) => Promise<unknown>,
) {
  return withServices({ auth: { login } }).services;
}

async function fillAndSubmit(username: string, password: string) {
  await fireEvent.changeText(
    screen.getByPlaceholderText('請輸入學號或帳號'),
    username,
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText('請輸入密碼'),
    password,
  );
  await fireEvent.press(screen.getByText('登入', { exact: true }));
}

describe('LoginScreen', () => {
  it('shows the validation message of the login service for empty fields', async () => {
    const login = jest.fn(
      async (input: { username: string; password: string }) => {
        assertCredentialsInput({
          username: input.username.trim(),
          password: input.password,
        });

        return { ok: true as const };
      },
    );
    await renderScreen(<LoginScreen />, loginServices(login));

    await fillAndSubmit('', '');

    expect(await screen.findByText('請輸入學號或帳號。')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('shows the failure message and lets the raw response be expanded', async () => {
    const login = jest.fn(async () => ({
      ok: false as const,
      message: '登入失敗，請確認帳號密碼。',
      raw: { status: 'Auth fail' },
    }));
    await renderScreen(<LoginScreen />, loginServices(login));

    await fillAndSubmit('s123', 'wrong');

    expect(await screen.findByText('登入失敗，請確認帳號密碼。')).toBeTruthy();
    expect(login).toHaveBeenCalledWith({
      username: 's123',
      password: 'wrong',
    });

    await fireEvent.press(
      screen.getByText('若登入持續失敗，可展開檢視伺服器回應內容'),
    );
    expect(screen.getByText(/"status": "Auth fail"/)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('signs in and replaces the screen with the course list', async () => {
    const login = jest.fn(async () => ({ ok: true as const }));
    await renderScreen(<LoginScreen />, loginServices(login));

    await fillAndSubmit('s123', 'secret');

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/courses'),
    );
  });

  it('links to the settings screen', async () => {
    await renderScreen(<LoginScreen />);

    await fireEvent.press(screen.getByText('設定'));

    expect(router.push).toHaveBeenCalledWith('/settings');
  });
});
