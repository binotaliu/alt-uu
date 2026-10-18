import type { KeyValueStoreRepository } from '../../db/keyValueStore';
import {
  PremiumRequiredError,
  ValidationError,
  type EntitlementChecker,
} from '../account/validation';
import { AppPreferenceStore } from './appPreferenceStore';
import {
  ALLOWED_ACCENT_COLORS,
  ALLOWED_APPEARANCES,
  ALLOWED_LIVE_SESSIONS_TIMEZONES,
  DEFAULT_ACCENT_COLOR,
  type AppPreferences,
  type AppPreferencesUpdate,
} from './types';

const BOOLEAN_FIELDS = [
  'nouToolsIntegrationEnabled',
  'screenReaderEnhancedSupportEnabled',
  'altUuPlusDisabled',
  'onboardingCompleted',
  'liveSessionNicknameModalEnabled',
  'cellularPlaybackWarningEnabled',
] as const;

export interface AppPreferenceServicesDeps {
  keyValues: KeyValueStoreRepository;
  /** Picking a non-default accent colour needs an active Alt UU+ entitlement. */
  isSubscriptionActive: EntitlementChecker;
}

/** GetAppPreferences, UpdateAppPreferences and the per-field getters/setters. */
export function createAppPreferenceServices(deps: AppPreferenceServicesDeps) {
  const store = new AppPreferenceStore(deps.keyValues);

  async function get(): Promise<AppPreferences> {
    return {
      appearance: await store.getAppearance(),
      accentColor: await store.getAccentColor(),
      nouToolsIntegrationEnabled: await store.getNouToolsIntegrationEnabled(),
      screenReaderEnhancedSupportEnabled:
        await store.getScreenReaderEnhancedSupportEnabled(),
      altUuPlusDisabled: await store.getAltUuPlusDisabled(),
      onboardingCompleted: await store.getOnboardingCompleted(),
      liveSessionsTimezone: await store.getLiveSessionsTimezone(),
      liveSessionNicknameModalEnabled:
        await store.getLiveSessionNicknameModalEnabled(),
      cellularPlaybackWarningEnabled:
        await store.getCellularPlaybackWarningEnabled(),
      whatsNewSeenVersion: await store.getWhatsNewSeenVersion(),
    };
  }

  async function update(input: AppPreferencesUpdate): Promise<AppPreferences> {
    validate(input);
    await ensureAccentColorChangeIsAllowed(input);

    if (input.appearance !== undefined) {
      await store.setAppearance(input.appearance);
    }

    if (input.accentColor !== undefined) {
      await store.setAccentColor(input.accentColor);
    }

    if (input.nouToolsIntegrationEnabled !== undefined) {
      await store.setNouToolsIntegrationEnabled(
        input.nouToolsIntegrationEnabled,
      );
    }

    if (input.screenReaderEnhancedSupportEnabled !== undefined) {
      await store.setScreenReaderEnhancedSupportEnabled(
        input.screenReaderEnhancedSupportEnabled,
      );
    }

    if (input.altUuPlusDisabled !== undefined) {
      await store.setAltUuPlusDisabled(input.altUuPlusDisabled);
    }

    if (input.onboardingCompleted !== undefined) {
      await store.setOnboardingCompleted(input.onboardingCompleted);
    }

    if (input.liveSessionsTimezone !== undefined) {
      await store.setLiveSessionsTimezone(input.liveSessionsTimezone);
    }

    if (input.liveSessionNicknameModalEnabled !== undefined) {
      await store.setLiveSessionNicknameModalEnabled(
        input.liveSessionNicknameModalEnabled,
      );
    }

    if (input.cellularPlaybackWarningEnabled !== undefined) {
      await store.setCellularPlaybackWarningEnabled(
        input.cellularPlaybackWarningEnabled,
      );
    }

    if (input.whatsNewSeenVersion !== undefined) {
      await store.setWhatsNewSeenVersion(input.whatsNewSeenVersion);
    }

    return get();
  }

  /**
   * Going back to the default accent (or keeping the current one) is always
   * allowed. Checked before anything is written so a refused update never
   * partially applies.
   */
  async function ensureAccentColorChangeIsAllowed(
    input: AppPreferencesUpdate,
  ): Promise<void> {
    if (input.accentColor === undefined) {
      return;
    }

    if (
      input.accentColor === DEFAULT_ACCENT_COLOR ||
      input.accentColor === (await store.getAccentColor())
    ) {
      return;
    }

    if (!(await deps.isSubscriptionActive())) {
      throw new PremiumRequiredError();
    }
  }

  return { store, get, update };
}

export type AppPreferenceServices = ReturnType<
  typeof createAppPreferenceServices
>;

function validate(input: AppPreferencesUpdate): void {
  const errors: Record<string, string[]> = {};
  const invalid = (field: string): void => {
    errors[field] = [`${field} 的值不正確。`];
  };

  if (
    input.appearance !== undefined &&
    !(ALLOWED_APPEARANCES as readonly string[]).includes(input.appearance)
  ) {
    invalid('appearance');
  }

  if (
    input.accentColor !== undefined &&
    !(ALLOWED_ACCENT_COLORS as readonly string[]).includes(input.accentColor)
  ) {
    invalid('accentColor');
  }

  if (
    input.liveSessionsTimezone !== undefined &&
    !(ALLOWED_LIVE_SESSIONS_TIMEZONES as readonly string[]).includes(
      input.liveSessionsTimezone,
    )
  ) {
    invalid('liveSessionsTimezone');
  }

  for (const field of BOOLEAN_FIELDS) {
    if (input[field] !== undefined && typeof input[field] !== 'boolean') {
      invalid(field);
    }
  }

  if (
    input.whatsNewSeenVersion !== undefined &&
    (typeof input.whatsNewSeenVersion !== 'string' ||
      [...input.whatsNewSeenVersion].length > 32)
  ) {
    invalid('whatsNewSeenVersion');
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }
}
