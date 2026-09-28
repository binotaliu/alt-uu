import {
    onActivated,
    onBeforeUnmount,
    onDeactivated,
    ref,
    watchEffect,
} from 'vue';
import type { Ref } from 'vue';

/**
 * Locks page scrolling while `locked` is true. Under <KeepAlive> the lock
 * only applies while the component is active, so a cached pane never freezes
 * the page it is hidden behind.
 */
export function useScrollLock(locked: Ref<boolean>): void {
    // onActivated also fires on a component's first mount, but a component
    // rendered outside <KeepAlive> never activates, so start out active and
    // let onDeactivated switch it off.
    const isActive = ref(true);

    onActivated(() => {
        isActive.value = true;
    });

    onDeactivated(() => {
        isActive.value = false;
    });

    watchEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        document.body.style.overflow =
            locked.value && isActive.value ? 'hidden' : '';
    });

    onBeforeUnmount(() => {
        if (typeof document !== 'undefined') {
            document.body.style.overflow = '';
        }
    });
}
