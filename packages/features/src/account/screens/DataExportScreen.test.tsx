import { UserFacingHttpError, ValidationError } from '@altuu/core';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { resetStores } from '../../testing/fakeServices';
import { renderScreen, withServices } from '../testing';
import { pickJsonFileText, saveTextFile } from '../lib/files';
import { DataExportScreen } from './DataExportScreen';

jest.mock('../lib/files', () => ({
  pickJsonFileText: jest.fn(),
  saveTextFile: jest.fn(),
}));

const pick = pickJsonFileText as jest.Mock;
const save = saveTextFile as jest.Mock;

beforeEach(() => {
  resetStores();
  pick.mockReset();
  save.mockReset();
  (router.push as jest.Mock).mockClear();
});

function setup({
  subscribed,
  importFile = jest.fn(),
}: {
  subscribed: boolean;
  importFile?: jest.Mock;
}) {
  const entitlement = {
    active: subscribed,
    productId: null,
    expiresAt: null,
    platform: null,
  };
  const exportFile = jest.fn(async () => ({
    fileName: 'alt-uu-data-export-2026-10-18.json',
    contents: '{"accounts":[]}',
  }));
  const { services } = withServices({
    subscription: {
      getCachedEntitlement: async () => entitlement,
      getEntitlementStatus: async () => entitlement,
    },
    dataPortability: { exportFile, importFile },
  });

  return { services, exportFile, importFile };
}

describe('DataExportScreen', () => {
  it('saves the export file through the system save dialog', async () => {
    save.mockResolvedValue(true);
    const { services, exportFile } = setup({ subscribed: false });
    await renderScreen(<DataExportScreen />, services);

    await fireEvent.press(screen.getByText('匯出為 JSON 檔案'));

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(exportFile).toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith(
      'alt-uu-data-export-2026-10-18.json',
      '{"accounts":[]}',
      'application/json',
    );
    expect(await screen.findByText('已匯出資料')).toBeTruthy();
  });

  it('shows nothing when the save dialog is dismissed', async () => {
    save.mockResolvedValue(false);
    const { services } = setup({ subscribed: false });
    await renderScreen(<DataExportScreen />, services);

    await fireEvent.press(screen.getByText('匯出為 JSON 檔案'));

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(screen.queryByText('已匯出資料')).toBeNull();
  });

  it('shows the export failure', async () => {
    save.mockRejectedValue(new UserFacingHttpError(500, '儲存檔案失敗。'));
    const { services } = setup({ subscribed: false });
    await renderScreen(<DataExportScreen />, services);

    await fireEvent.press(screen.getByText('匯出為 JSON 檔案'));

    expect(await screen.findByText('儲存檔案失敗。')).toBeTruthy();
  });

  it('offers the upgrade instead of importing without Alt UU+', async () => {
    const { services, importFile } = setup({ subscribed: false });
    await renderScreen(<DataExportScreen />, services);

    await fireEvent.press(screen.getByText('選擇檔案匯入'));

    expect(await screen.findByText('資料匯入為 Alt UU+ 專屬功能')).toBeTruthy();
    expect(pick).not.toHaveBeenCalled();
    expect(importFile).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('升級'));
    expect(router.push).toHaveBeenCalledWith('/courses/account/subscription');
  });

  it('shows the service message when the file cannot be imported', async () => {
    pick.mockResolvedValue('not json');
    const importFile = jest.fn(async () => {
      throw ValidationError.field('accounts', '匯入的檔案格式不正確。');
    });
    const { services } = setup({ subscribed: true, importFile });
    await renderScreen(<DataExportScreen />, services);
    await waitFor(() => expect(screen.queryByText('Alt UU+')).toBeNull());

    await fireEvent.press(screen.getByText('選擇檔案匯入'));

    expect(await screen.findByText('匯入的檔案格式不正確。')).toBeTruthy();
    expect(importFile).toHaveBeenCalledWith('not json');
    expect(screen.queryByText('已匯入資料')).toBeNull();
  });

  it('reports what was imported and which usernames were skipped', async () => {
    pick.mockResolvedValue('{}');
    const importFile = jest.fn(async () => ({
      importedAccountsCount: 1,
      skippedUsernames: ['ghost', 'other'],
      importedPlaybackProgressCount: 4,
      importedAccountDailyActivitiesCount: 9,
    }));
    const { services } = setup({ subscribed: true, importFile });
    await renderScreen(<DataExportScreen />, services);
    await waitFor(() => expect(screen.queryByText('Alt UU+')).toBeNull());

    await fireEvent.press(screen.getByText('選擇檔案匯入'));

    expect(
      await screen.findByText(
        '已匯入 1 個帳號的資料，共 4 筆播放進度、9 筆每日學習活動。',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        '以下使用者名稱在本裝置找不到對應帳號，已略過：ghost、other',
      ),
    ).toBeTruthy();
  });

  it('does nothing when the picker is cancelled', async () => {
    pick.mockResolvedValue(null);
    const { services, importFile } = setup({ subscribed: true });
    await renderScreen(<DataExportScreen />, services);
    await waitFor(() => expect(screen.queryByText('Alt UU+')).toBeNull());

    await fireEvent.press(screen.getByText('選擇檔案匯入'));

    await waitFor(() => expect(pick).toHaveBeenCalled());
    expect(importFile).not.toHaveBeenCalled();
  });
});
