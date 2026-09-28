declare global {
    interface Window {
        appearance?: 'system' | 'light' | 'dark';
        showFlashMessage: (message: string, type: 'success' | 'error') => void;
    }
}

export {};
