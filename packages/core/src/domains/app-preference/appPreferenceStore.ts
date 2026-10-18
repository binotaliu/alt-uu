import type { KeyValueStoreRepository } from '../../db/keyValueStore';
import { isRecord } from '../../http/encoding';
import {
  ALLOWED_ACCENT_COLORS,
  ALLOWED_APPEARANCES,
  ALLOWED_LIVE_SESSIONS_TIMEZONES,
  DEFAULT_ACCENT_COLOR,
  type AccentColor,
  type Appearance,
  type LiveSessionsTimezone,
} from './types';

const KEYS = {
  appearance: 'preference:appearance',
  accentColor: 'preference:accent-color',
  nouToolsIntegration: 'preference:nou-tools-integration',
  screenReaderEnhancedSupport: 'preference:screen-reader-enhanced-support',
  altUuPlusDisabled: 'preference:alt-uu-plus-disabled',
  onboardingCompleted: 'preference:onboarding-completed',
  liveSessionsTimezone: 'preference:live-sessions-timezone',
  liveSessionNicknameModalEnabled:
    'preference:live-session-nickname-modal-enabled',
  cellularPlaybackWarningEnabled:
    'preference:cellular-playback-warning-enabled',
  whatsNewSeenVersion: 'preference:whats-new-seen-version',
  diagnosticsRecordingUntil: 'preference:diagnostics-recording-until',
} as const;

/**
 * Reads the JSON object stored under `key` (legacy `json_decode` + `Arr::get`).
 * A missing row, invalid JSON or a non-object value reads as `null`.
 */
export async function readJsonRecord(
  keyValues: KeyValueStoreRepository,
  key: string,
): Promise<Record<string, unknown> | null> {
  const stored = await keyValues.get(key);

  if (stored === null) {
    return null;
  }

  try {
    const decoded: unknown = JSON.parse(stored);

    return isRecord(decoded) ? (decoded as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Port of the legacy AppPreferenceStore (values are JSON in key_value_store). */
export class AppPreferenceStore {
  constructor(private readonly keyValues: KeyValueStoreRepository) {}

  async getAppearance(): Promise<Appearance> {
    return this.getOneOf(
      KEYS.appearance,
      'appearance',
      ALLOWED_APPEARANCES,
      'system',
    );
  }

  async setAppearance(appearance: string): Promise<Appearance> {
    const value = pick(appearance, ALLOWED_APPEARANCES, 'system');
    await this.write(KEYS.appearance, { appearance: value });

    return value;
  }

  async getAccentColor(): Promise<AccentColor> {
    return this.getOneOf(
      KEYS.accentColor,
      'accentColor',
      ALLOWED_ACCENT_COLORS,
      DEFAULT_ACCENT_COLOR,
    );
  }

  async setAccentColor(accentColor: string): Promise<AccentColor> {
    const value = pick(
      accentColor,
      ALLOWED_ACCENT_COLORS,
      DEFAULT_ACCENT_COLOR,
    );
    await this.write(KEYS.accentColor, { accentColor: value });

    return value;
  }

  getNouToolsIntegrationEnabled(): Promise<boolean> {
    return this.getBoolean(KEYS.nouToolsIntegration, 'enabled', false);
  }

  setNouToolsIntegrationEnabled(enabled: boolean): Promise<boolean> {
    return this.setBoolean(KEYS.nouToolsIntegration, 'enabled', enabled);
  }

  getScreenReaderEnhancedSupportEnabled(): Promise<boolean> {
    return this.getBoolean(KEYS.screenReaderEnhancedSupport, 'enabled', false);
  }

  setScreenReaderEnhancedSupportEnabled(enabled: boolean): Promise<boolean> {
    return this.setBoolean(
      KEYS.screenReaderEnhancedSupport,
      'enabled',
      enabled,
    );
  }

  getAltUuPlusDisabled(): Promise<boolean> {
    return this.getBoolean(KEYS.altUuPlusDisabled, 'disabled', false);
  }

  setAltUuPlusDisabled(disabled: boolean): Promise<boolean> {
    return this.setBoolean(KEYS.altUuPlusDisabled, 'disabled', disabled);
  }

  getOnboardingCompleted(): Promise<boolean> {
    return this.getBoolean(KEYS.onboardingCompleted, 'completed', false);
  }

  setOnboardingCompleted(completed: boolean): Promise<boolean> {
    return this.setBoolean(KEYS.onboardingCompleted, 'completed', completed);
  }

  getLiveSessionsTimezone(): Promise<LiveSessionsTimezone> {
    return this.getOneOf(
      KEYS.liveSessionsTimezone,
      'timezone',
      ALLOWED_LIVE_SESSIONS_TIMEZONES,
      'taiwan',
    );
  }

  async setLiveSessionsTimezone(
    timezone: string,
  ): Promise<LiveSessionsTimezone> {
    const value = pick(timezone, ALLOWED_LIVE_SESSIONS_TIMEZONES, 'taiwan');
    await this.write(KEYS.liveSessionsTimezone, { timezone: value });

    return value;
  }

  getLiveSessionNicknameModalEnabled(): Promise<boolean> {
    return this.getBoolean(
      KEYS.liveSessionNicknameModalEnabled,
      'enabled',
      true,
    );
  }

  setLiveSessionNicknameModalEnabled(enabled: boolean): Promise<boolean> {
    return this.setBoolean(
      KEYS.liveSessionNicknameModalEnabled,
      'enabled',
      enabled,
    );
  }

  getCellularPlaybackWarningEnabled(): Promise<boolean> {
    return this.getBoolean(
      KEYS.cellularPlaybackWarningEnabled,
      'enabled',
      true,
    );
  }

  setCellularPlaybackWarningEnabled(enabled: boolean): Promise<boolean> {
    return this.setBoolean(
      KEYS.cellularPlaybackWarningEnabled,
      'enabled',
      enabled,
    );
  }

  /** The app version whose release notes the user last saw, or an empty string. */
  async getWhatsNewSeenVersion(): Promise<string> {
    const record = await readJsonRecord(
      this.keyValues,
      KEYS.whatsNewSeenVersion,
    );
    const version = record?.version;

    return typeof version === 'string' ? version : '';
  }

  async setWhatsNewSeenVersion(version: string): Promise<string> {
    await this.write(KEYS.whatsNewSeenVersion, { version });

    return version;
  }

  /**
   * When diagnostic recording should stop, or null when it is not running.
   * Stored as an expiry so the window enforces itself against the clock.
   */
  async getDiagnosticsRecordingUntil(): Promise<Date | null> {
    const record = await readJsonRecord(
      this.keyValues,
      KEYS.diagnosticsRecordingUntil,
    );
    const until = record?.until;

    if (typeof until !== 'string' || until === '') {
      return null;
    }

    const parsed = new Date(until);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  async setDiagnosticsRecordingUntil(until: Date | null): Promise<Date | null> {
    await this.write(KEYS.diagnosticsRecordingUntil, {
      until: until === null ? null : toAtomString(until),
    });

    return until;
  }

  private async getOneOf<T extends string>(
    key: string,
    field: string,
    allowed: readonly T[],
    fallback: T,
  ): Promise<T> {
    const record = await readJsonRecord(this.keyValues, key);
    const value = record?.[field];

    return typeof value === 'string' &&
      (allowed as readonly string[]).includes(value)
      ? (value as T)
      : fallback;
  }

  private async getBoolean(
    key: string,
    field: string,
    fallback: boolean,
  ): Promise<boolean> {
    const record = await readJsonRecord(this.keyValues, key);
    const value = record?.[field];

    return typeof value === 'boolean' ? value : fallback;
  }

  private async setBoolean(
    key: string,
    field: string,
    value: boolean,
  ): Promise<boolean> {
    await this.write(key, { [field]: value });

    return value;
  }

  private write(key: string, value: Record<string, unknown>): Promise<void> {
    return this.keyValues.set(key, JSON.stringify(value));
  }
}

function pick<T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T,
): T {
  return (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** PHP `DateTimeInterface::ATOM` in UTC (`2026-10-01T00:00:00+00:00`). */
function toAtomString(date: Date): string {
  return `${date.toISOString().slice(0, 19)}+00:00`;
}
