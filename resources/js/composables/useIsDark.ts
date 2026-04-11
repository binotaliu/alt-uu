import { ref, onMounted, onUnmounted } from 'vue';

/**
 * Returns a reactive `isDark` boolean that mirrors whether the `.dark` class
 * is currently present on `<html>`. The value updates automatically whenever:
 *
 * - The user switches the appearance preference (which adds/removes `.dark`).
 * - The system colour scheme changes and the preference is set to "system".
 *
 * Safe to call in any component; connect/disconnect of the MutationObserver
 * is handled via `onMounted` / `onUnmounted`.
 */
export function useIsDark() {
    const isDark = ref(
        typeof document !== 'undefined' &&
            document.documentElement.classList.contains('dark'),
    );

    const observer = new MutationObserver(() => {
        isDark.value = document.documentElement.classList.contains('dark');
    });

    onMounted(() => {
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });
    });

    onUnmounted(() => {
        observer.disconnect();
    });

    return { isDark };
}
