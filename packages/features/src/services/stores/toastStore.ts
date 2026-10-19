import { create } from 'zustand';

export interface ToastState {
  message: string | null;
  /** Bumped per toast so showing the same message again restarts the timer. */
  id: number;
  show: (message: string) => void;
  hide: () => void;
}

/** Shared so the host mounted once in the root can show a toast from anywhere. */
export const useToastStore = create<ToastState>()((set) => ({
  message: null,
  id: 0,
  show: (message) => set((state) => ({ message, id: state.id + 1 })),
  hide: () => set({ message: null }),
}));
