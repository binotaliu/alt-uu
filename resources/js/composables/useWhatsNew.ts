import { ref } from 'vue';

// Shared so the sheet mounted once in AppRoot can be opened from anywhere
// (the post-upgrade auto-show in MainScreen, the Settings button).
const isOpen = ref(false);

export function useWhatsNew() {
    return {
        isOpen,
        open: (): void => {
            isOpen.value = true;
        },
        close: (): void => {
            isOpen.value = false;
        },
    };
}
