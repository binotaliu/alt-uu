import { create } from 'zustand';

export interface WhatsNewState {
    isOpen: boolean;
    open: () => void;
    close: () => void;
}

/** Shared so the sheet mounted once in the root can be opened from anywhere. */
export const useWhatsNewStore = create<WhatsNewState>()((set) => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
}));
