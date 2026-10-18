import type { AccountViewModel } from '@altuu/core';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import { useClientConfigStore } from '../../services/stores';
import { account, resetStores } from '../../testing/fakeServices';
import { renderScreen, withServices } from '../testing';
import { AccountsScreen } from './AccountsScreen';

beforeEach(() => {
  resetStores();
  (router.push as jest.Mock).mockClear();
  (router.replace as jest.Mock).mockClear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

function setup(initial: AccountViewModel[]) {
  let accounts = initial;
  const switchTo = jest.fn(async (id: number) => {
    accounts = accounts.map((item) => ({
      ...item,
      isActive: item.id === id,
    }));

    return { ok: true as const, message: '' as const, accounts };
  });
  const rename = jest.fn(async (id: number, nickname: string | null) => {
    accounts = accounts.map((item) =>
      item.id === id ? { ...item, nickname } : item,
    );

    return accounts;
  });
  const remove = jest.fn(async (id: number) => {
    accounts = accounts.filter((item) => item.id !== id);

    return accounts;
  });
  const { services } = withServices({
    account: { list: async () => accounts, switchTo, rename, remove },
  });

  return { services, switchTo, rename, remove };
}

describe('AccountsScreen', () => {
  it('lists the accounts and marks the active one', async () => {
    const { services } = setup([
      account(1, { isActive: true, nickname: '主帳號' }),
      account(2),
    ]);
    await renderScreen(<AccountsScreen />, services);

    expect(await screen.findByText('主帳號')).toBeTruthy();
    expect(screen.getByText('user2')).toBeTruthy();
    expect(screen.getAllByText('目前帳號')).toHaveLength(1);
  });

  it('switches to another account and returns to the course list', async () => {
    const { services, switchTo } = setup([
      account(1, { isActive: true }),
      account(2),
    ]);
    await renderScreen(<AccountsScreen />, services);

    await fireEvent.press(await screen.findByText('user2'));
    await fireEvent.press(screen.getByRole('button', { name: '切換帳號' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/courses'));
    expect(switchTo).toHaveBeenCalledWith(2);
  });

  it('sends an expired account to the re-login screen', async () => {
    const { services } = setup([account(1, { isActive: true }), account(2)]);
    (services.account as unknown as { switchTo: jest.Mock }).switchTo = jest.fn(
      async () => ({
        ok: false as const,
        message: '此帳號的登入已失效，請重新輸入密碼。',
      }),
    );
    await renderScreen(<AccountsScreen />, services);

    await fireEvent.press(await screen.findByText('user2'));
    await fireEvent.press(screen.getByRole('button', { name: '切換帳號' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/reauth/2'));
  });

  it('renames an account through the dialog', async () => {
    const { services, rename } = setup([account(1, { isActive: true })]);
    await renderScreen(<AccountsScreen />, services);

    await fireEvent.press(await screen.findByText('user1'));
    await fireEvent.press(screen.getByText('修改名稱'));
    await fireEvent.changeText(screen.getByLabelText('自訂名稱'), '  小華 ');
    await fireEvent.press(screen.getByText('儲存'));

    await waitFor(() => expect(rename).toHaveBeenCalledWith(1, '小華'));
    expect(await screen.findByText('小華')).toBeTruthy();
  });

  it('clears the nickname when the field is emptied', async () => {
    const { services, rename } = setup([
      account(1, { isActive: true, nickname: '舊名' }),
    ]);
    await renderScreen(<AccountsScreen />, services);

    await fireEvent.press(await screen.findByText('舊名'));
    await fireEvent.press(screen.getByText('修改名稱'));
    await fireEvent.changeText(screen.getByLabelText('自訂名稱'), '');
    await fireEvent.press(screen.getByText('儲存'));

    await waitFor(() => expect(rename).toHaveBeenCalledWith(1, null));
  });

  it('asks before removing, and removes the account', async () => {
    const { services, remove } = setup([
      account(1, { isActive: true }),
      account(2),
    ]);
    await renderScreen(<AccountsScreen />, services);

    await fireEvent.press(await screen.findByText('user2'));
    await fireEvent.press(screen.getByText('登出此帳號'));

    expect(
      screen.getByText(
        '確定要移除這個帳號嗎？移除後將登出該帳號的所有裝置端資料。',
      ),
    ).toBeTruthy();
    expect(remove).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('移除'));

    await waitFor(() => expect(remove).toHaveBeenCalledWith(2));
    await waitFor(() => expect(screen.queryByText('user2')).toBeNull());
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('leaves for the login screen after removing the last active account', async () => {
    useClientConfigStore.getState().setSession('authenticated');
    const { services } = setup([account(1, { isActive: true })]);
    await renderScreen(<AccountsScreen />, services);

    await fireEvent.press(await screen.findByText('user1'));
    await fireEvent.press(screen.getByText('登出此帳號'));
    await fireEvent.press(screen.getByText('移除'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
    expect(useClientConfigStore.getState().sessionStatus).toBe(
      'unauthenticated',
    );
  });

  it('adds an account and shows the service error when it fails', async () => {
    const add = jest.fn(async () => ({
      ok: false as const,
      message: '最多只能新增 5 個帳號。',
    }));
    const { services } = setup([account(1, { isActive: true })]);
    (services.account as unknown as { add: jest.Mock }).add = add;
    await renderScreen(<AccountsScreen />, services);

    await fireEvent.press(await screen.findByText('新增帳號'));
    await fireEvent.changeText(
      screen.getByPlaceholderText('請輸入學號或帳號'),
      's999',
    );
    await fireEvent.changeText(screen.getByPlaceholderText('請輸入密碼'), 'pw');
    await fireEvent.press(screen.getByText('確認新增'));

    expect(await screen.findByText('最多只能新增 5 個帳號。')).toBeTruthy();
    expect(add).toHaveBeenCalledWith({ username: 's999', password: 'pw' });
  });
});
