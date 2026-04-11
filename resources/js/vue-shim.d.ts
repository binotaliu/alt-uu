declare module '*.vue' {
    import type { DefineComponent } from 'vue';

    const component: DefineComponent<
        Record<string, never>,
        Record<string, never>,
        unknown
    >;
    export default component;
}

declare global {
    interface Window {
        appearance?: 'system' | 'light' | 'dark';
        showFlashMessage: (message: string, type: 'success' | 'error') => void;
    }
}

export {};
