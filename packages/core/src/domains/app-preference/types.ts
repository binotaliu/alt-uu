export const ALLOWED_APPEARANCES = ['system', 'light', 'dark'] as const;
export const ALLOWED_ACCENT_COLORS = [
    'warm',
    'ocean',
    'forest',
    'purple',
    'pink',
    'red',
    'grey',
] as const;
export const ALLOWED_LIVE_SESSIONS_TIMEZONES = ['taiwan', 'local'] as const;

export type Appearance = (typeof ALLOWED_APPEARANCES)[number];
export type AccentColor = (typeof ALLOWED_ACCENT_COLORS)[number];
export type LiveSessionsTimezone =
    (typeof ALLOWED_LIVE_SESSIONS_TIMEZONES)[number];

export const DEFAULT_ACCENT_COLOR: AccentColor = 'warm';

/** Legacy AppPreferencesViewModel. */
export interface AppPreferences {
    appearance: Appearance;
    accentColor: AccentColor;
    nouToolsIntegrationEnabled: boolean;
    screenReaderEnhancedSupportEnabled: boolean;
    altUuPlusDisabled: boolean;
    onboardingCompleted: boolean;
    liveSessionsTimezone: LiveSessionsTimezone;
    liveSessionNicknameModalEnabled: boolean;
    cellularPlaybackWarningEnabled: boolean;
    whatsNewSeenVersion: string;
}

/** PATCH body of the legacy `/api/preferences`: only supplied keys change. */
export type AppPreferencesUpdate = Partial<AppPreferences>;
