import type { AppPreferences, SessionProfileViewModel } from '@altuu/core';
import { create } from 'zustand';

export const defaultPreferences: AppPreferences = {
  appearance: 'system',
  accentColor: 'warm',
  nouToolsIntegrationEnabled: false,
  screenReaderEnhancedSupportEnabled: false,
  altUuPlusDisabled: false,
  onboardingCompleted: false,
  liveSessionsTimezone: 'taiwan',
  liveSessionNicknameModalEnabled: true,
  cellularPlaybackWarningEnabled: true,
  whatsNewSeenVersion: '',
};

/** `unknown` until the launch-time session check has finished. */
export type SessionStatus = 'unknown' | 'authenticated' | 'unauthenticated';

export interface ClientConfigState {
  preferences: AppPreferences;
  preferencesLoaded: boolean;
  sessionStatus: SessionStatus;
  profile: SessionProfileViewModel | null;
  applyPreferences: (preferences: AppPreferences) => void;
  setSession: (
    status: SessionStatus,
    profile?: SessionProfileViewModel | null,
  ) => void;
  reset: () => void;
}

/**
 * Client-side mirror of the persisted preferences plus the session state, so
 * theme and navigation can read them synchronously (legacy appConfig store).
 * Writes go through `useUpdatePreferences`, which persists first.
 */
export const useClientConfigStore = create<ClientConfigState>()((set) => ({
  preferences: defaultPreferences,
  preferencesLoaded: false,
  sessionStatus: 'unknown',
  profile: null,
  applyPreferences: (preferences) =>
    set({ preferences, preferencesLoaded: true }),
  setSession: (sessionStatus, profile = null) =>
    set({ sessionStatus, profile }),
  reset: () =>
    set({
      preferences: defaultPreferences,
      preferencesLoaded: false,
      sessionStatus: 'unknown',
      profile: null,
    }),
}));
