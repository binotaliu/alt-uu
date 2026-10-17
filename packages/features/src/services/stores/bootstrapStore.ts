import { create } from 'zustand';

export type InitialRoute = '/onboarding' | '/login' | '/courses';

export interface BootstrapState {
    ready: boolean;
    initialRoute: InitialRoute;
    setReady: (initialRoute: InitialRoute) => void;
    reset: () => void;
}

/** Result of the launch sequence; `app/index.tsx` redirects to `initialRoute`. */
export const useBootstrapStore = create<BootstrapState>()((set) => ({
    ready: false,
    initialRoute: '/login',
    setReady: (initialRoute) => set({ ready: true, initialRoute }),
    reset: () => set({ ready: false, initialRoute: '/login' }),
}));
