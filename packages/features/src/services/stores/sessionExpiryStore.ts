import { create } from 'zustand';

export interface SessionExpiryState {
  pickerOpen: boolean;
  failedAccountId: number | null;
  /** Where to go after re-login succeeds (set when leaving for /reauth). */
  returnTo: string | null;
  /** Mirrors the current route so the expiry flow can tell where it is. */
  currentPath: string;
  openPicker: (accountId: number | null) => void;
  closePicker: () => void;
  setReturnTo: (path: string | null) => void;
  setCurrentPath: (path: string) => void;
  reset: () => void;
}

const initialState = {
  pickerOpen: false,
  failedAccountId: null,
  returnTo: null,
  currentPath: '/',
};

/** Legacy sessionExpiry Pinia store. */
export const useSessionExpiryStore = create<SessionExpiryState>()((set) => ({
  ...initialState,
  openPicker: (accountId) =>
    set({ failedAccountId: accountId, pickerOpen: true }),
  closePicker: () => set({ pickerOpen: false }),
  setReturnTo: (path) => set({ returnTo: path }),
  setCurrentPath: (path) => set({ currentPath: path }),
  reset: () => set(initialState),
}));
