import { describe, expect, it } from 'vitest';
import { createHarness } from '../account/testing';
import { PremiumRequiredError, ValidationError } from '../account/validation';
import { createAppConfigServices, resolveDisplayVersion } from '../app-config';
import { createMaterialPreferenceServices } from '../material-preference';
import { createAppPreferenceServices, type AppPreferences } from './index';

const defaults: AppPreferences = {
  appearance: 'system',
  accentColor: 'warm',
  nouToolsIntegrationEnabled: false,
  altUuPlusDisabled: false,
  onboardingCompleted: false,
  liveSessionsTimezone: 'taiwan',
  liveSessionNicknameModalEnabled: true,
  cellularPlaybackWarningEnabled: true,
  whatsNewSeenVersion: '',
};

async function setup(subscribed = false) {
  const harness = await createHarness();
  const preferences = createAppPreferenceServices({
    keyValues: harness.keyValues,
    isSubscriptionActive: async () => subscribed,
  });

  return { harness, preferences };
}

// Ported from tests/Feature/AppPreference/AppPreferencesControllerTest.php
describe('app preferences', () => {
  it('returns default preferences', async () => {
    const { preferences } = await setup();

    expect(await preferences.get()).toEqual(defaults);
  });

  it('updates only the supplied fields and stores them as legacy JSON', async () => {
    const { harness, preferences } = await setup();

    expect(await preferences.update({ appearance: 'dark' })).toEqual({
      ...defaults,
      appearance: 'dark',
    });
    expect(await harness.keyValues.get('preference:appearance')).toBe(
      '{"appearance":"dark"}',
    );

    expect(
      await preferences.update({
        nouToolsIntegrationEnabled: true,
        onboardingCompleted: true,
      }),
    ).toEqual({
      ...defaults,
      appearance: 'dark',
      nouToolsIntegrationEnabled: true,
      onboardingCompleted: true,
    });
    expect(
      await harness.keyValues.get('preference:nou-tools-integration'),
    ).toBe('{"enabled":true}');
  });

  it('updates every field in a single request', async () => {
    const { preferences } = await setup(true);
    const everything: AppPreferences = {
      appearance: 'light',
      accentColor: 'ocean',
      nouToolsIntegrationEnabled: true,
      altUuPlusDisabled: true,
      onboardingCompleted: true,
      liveSessionsTimezone: 'local',
      liveSessionNicknameModalEnabled: false,
      cellularPlaybackWarningEnabled: false,
      whatsNewSeenVersion: '1.1.0',
    };

    expect(await preferences.update(everything)).toEqual(everything);
  });

  it('deletes the stored value of the removed screen reader option', async () => {
    const { harness, preferences } = await setup();
    await harness.keyValues.set(
      'preference:screen-reader-enhanced-support',
      '{"enabled":true}',
    );
    await harness.keyValues.set(
      'preference:appearance',
      '{"appearance":"dark"}',
    );

    await preferences.store.removeObsoleteKeys();

    expect(
      await harness.keyValues.get('preference:screen-reader-enhanced-support'),
    ).toBeNull();
    expect(await harness.keyValues.get('preference:appearance')).toBe(
      '{"appearance":"dark"}',
    );
  });

  it('rejects invalid values', async () => {
    const { preferences } = await setup(true);

    await expect(
      preferences.update({ appearance: 'ultraviolet' as never }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      preferences.update({ accentColor: 'neon' as never }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      preferences.update({ liveSessionsTimezone: 'utc' as never }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      preferences.update({ whatsNewSeenVersion: 'x'.repeat(33) }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await preferences.get()).accentColor).toBe('warm');
  });

  it.each([
    'warm',
    'ocean',
    'forest',
    'purple',
    'pink',
    'red',
    'grey',
  ] as const)('persists accent color %s', async (accentColor) => {
    const { harness, preferences } = await setup(true);

    expect((await preferences.update({ accentColor })).accentColor).toBe(
      accentColor,
    );
    expect(await harness.keyValues.get('preference:accent-color')).toBe(
      JSON.stringify({ accentColor }),
    );
  });

  it('requires a subscription for a non-default accent and does not partially apply', async () => {
    const { preferences } = await setup(false);

    await expect(
      preferences.update({ accentColor: 'ocean', appearance: 'dark' }),
    ).rejects.toBeInstanceOf(PremiumRequiredError);
    expect(await preferences.get()).toEqual(defaults);
  });

  it('lets a non-subscriber go back to the default accent and keeps appearance free', async () => {
    const { harness, preferences } = await setup(false);
    await harness.keyValues.set(
      'preference:accent-color',
      JSON.stringify({ accentColor: 'ocean' }),
    );

    expect(
      (
        await preferences.update({
          accentColor: 'warm',
          appearance: 'dark',
        })
      ).accentColor,
    ).toBe('warm');
  });

  it('falls back to the default when a stored value is invalid or unreadable', async () => {
    const { harness, preferences } = await setup();
    await harness.keyValues.set(
      'preference:accent-color',
      JSON.stringify({ accentColor: 'neon' }),
    );
    await harness.keyValues.set('preference:appearance', 'not json');
    await harness.keyValues.set(
      'preference:onboarding-completed',
      JSON.stringify({ completed: 'yes' }),
    );

    expect(await preferences.get()).toEqual(defaults);
  });

  it('stores the diagnostics recording expiry as an ATOM string', async () => {
    const { harness, preferences } = await setup();
    const until = new Date('2026-10-01T00:30:00Z');

    await preferences.store.setDiagnosticsRecordingUntil(until);

    expect(
      await harness.keyValues.get('preference:diagnostics-recording-until'),
    ).toBe('{"until":"2026-10-01T00:30:00+00:00"}');
    expect(await preferences.store.getDiagnosticsRecordingUntil()).toEqual(
      until,
    );
    await preferences.store.setDiagnosticsRecordingUntil(null);
    expect(await preferences.store.getDiagnosticsRecordingUntil()).toBeNull();
  });
});

describe('app config', () => {
  const buildConfig = {
    appName: 'Alt UU',
    appVersion: '1.1.0',
    appVersionCode: '12',
    frameworkVersion: 'rn-1',
    materialSourceViewerEnabled: false,
  };

  it('reflects preferences and build config', async () => {
    const { harness, preferences } = await setup(true);
    await preferences.update({
      altUuPlusDisabled: true,
      accentColor: 'forest',
    });
    const config = await createAppConfigServices({
      preferences: preferences.store,
      buildConfig: { ...buildConfig, materialSourceViewerEnabled: true },
    }).get();

    expect(config).toMatchObject({
      accentColor: 'forest',
      altUuPlusDisabled: true,
      appName: 'Alt UU',
      appVersion: '1.1.0',
      appDisplayVersion: 'v1.1.0',
      materialSourceViewerEnabled: true,
    });
    expect(harness).toBeDefined();
  });

  it.each([
    { appVersion: '1.1.0', displayVersion: null, expected: 'v1.1.0' },
    { appVersion: 'DEBUG', displayVersion: null, expected: 'DEBUG' },
    { appVersion: '1.1.0', displayVersion: '  ', expected: 'v1.1.0' },
    {
      appVersion: '1.1.0',
      displayVersion: ' v1.1.0-RC1 ',
      expected: 'v1.1.0-RC1',
    },
  ])('derives the display version %#', ({ expected, ...input }) => {
    expect(resolveDisplayVersion(input)).toBe(expected);
  });
});

// Ported from tests/Feature/MaterialPreference/MaterialPreferenceTest.php
describe('material preference', () => {
  it('returns the default scale and persists a new one globally', async () => {
    const { harness } = await setup();
    const material = createMaterialPreferenceServices({
      keyValues: harness.keyValues,
    });

    expect(await material.getFontScale()).toEqual({ scale: 1 });
    expect(await material.setFontScale(1.35)).toEqual({ scale: 1.35 });
    expect(await harness.keyValues.get('preference:material-html-scale')).toBe(
      '{"scale":1.35}',
    );
    expect(await material.getFontScale()).toEqual({ scale: 1.35 });
  });

  it('rejects out-of-range scales and clamps a stale stored value', async () => {
    const { harness } = await setup();
    const material = createMaterialPreferenceServices({
      keyValues: harness.keyValues,
    });

    await expect(material.setFontScale(0.5)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(material.setFontScale(1.7)).rejects.toBeInstanceOf(
      ValidationError,
    );

    await harness.keyValues.set(
      'preference:material-html-scale',
      '{"scale":3}',
    );
    expect(await material.getFontScale()).toEqual({ scale: 1.6 });
    await harness.keyValues.set(
      'preference:material-html-scale',
      '{"scale":"abc"}',
    );
    expect(await material.getFontScale()).toEqual({ scale: 1 });
  });
});
