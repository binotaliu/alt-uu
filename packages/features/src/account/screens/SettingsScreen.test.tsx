import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useWhatsNewStore } from '../../services/stores';
import { resetStores } from '../../testing/fakeServices';
import { renderScreen, withServices } from '../testing';
import { SettingsScreen } from './SettingsScreen';

jest.mock('../lib/files', () => ({ clearDownloadedAttachments: jest.fn() }));

beforeEach(() => {
  resetStores();
  (router.push as jest.Mock).mockClear();
});

function setup({ materialSourceViewerEnabled = false } = {}) {
  const appConfig = {
    appearance: 'system',
    accentColor: 'warm',
    appName: 'Alt UU',
    appVersion: '1.1.0',
    appVersionCode: '42',
    appDisplayVersion: 'v1.1.0',
    frameworkVersion: '58',
    materialSourceViewerEnabled,
  };
  const { services, state } = withServices({
    appConfig: { get: async () => appConfig },
    diagnostics: {
      getRecordingStatus: async () => ({
        available: true,
        recording: false,
        expiresAt: null,
        windowMinutes: 30,
        retentionDays: 14,
      }),
    },
    subscription: {
      getCachedEntitlement: async () => ({
        active: false,
        productId: null,
        expiresAt: null,
        platform: null,
      }),
    },
  });

  return { services, state };
}

describe('SettingsScreen', () => {
  it('hides the build number until the version is tapped five times', async () => {
    const { services } = setup();
    await renderScreen(<SettingsScreen />, services);
    const version = await screen.findByText('v1.1.0');

    for (let tap = 0; tap < 4; tap += 1) {
      await fireEvent.press(version);
    }
    expect(screen.getByTestId('app-version').props.children).not.toContain(
      ' (42)',
    );
    expect(screen.queryByText(/\(42\)/)).toBeNull();

    await fireEvent.press(version);

    expect(await screen.findByText(/v1\.1\.0.*\(42\)/)).toBeTruthy();
  });

  it('hides the material source viewer when the build flag is off', async () => {
    const { services } = setup();
    await renderScreen(<SettingsScreen />, services);
    await screen.findByText('v1.1.0');

    expect(screen.queryByText('教材來源檢視')).toBeNull();
  });

  it('offers the material source viewer when the build flag is on', async () => {
    const { services } = setup({ materialSourceViewerEnabled: true });
    await renderScreen(<SettingsScreen />, services);

    expect(await screen.findByText('教材來源檢視')).toBeTruthy();
    await fireEvent.press(screen.getByText('檢視來源'));
    expect(router.push).toHaveBeenCalledWith('/settings/diagnostics/material');
  });

  it('persists a preference switch', async () => {
    const { services, state } = setup();
    await renderScreen(<SettingsScreen />, services);

    await fireEvent.press(await screen.findByLabelText('切換行動網路播放提醒'));

    await waitFor(() =>
      expect(state.preferences.cellularPlaybackWarningEnabled).toBe(false),
    );
  });

  it('opens the diagnostics and what-is-new entries', async () => {
    const { services } = setup();
    await renderScreen(<SettingsScreen />, services);

    await fireEvent.press(await screen.findByText('連線診斷'));
    expect(router.push).toHaveBeenCalledWith('/settings/diagnostics');

    await fireEvent.press(screen.getByText('檢視診斷記錄'));
    expect(router.push).toHaveBeenCalledWith('/settings/diagnostics/log');

    await fireEvent.press(screen.getByText('檢視新功能'));
    expect(useWhatsNewStore.getState().isOpen).toBe(true);
  });
});
