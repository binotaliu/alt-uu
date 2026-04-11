import {
    getNativeMediaState,
    isNativeMediaBridgeAvailable,
} from '@/lib/nativeMediaPlayer';
import router from '@/router';

function normalizeRoutePath(routePath: unknown): string | null {
    if (typeof routePath !== 'string') {
        return null;
    }

    const trimmed = routePath.trim();

    if (trimmed === '' || !trimmed.startsWith('/')) {
        return null;
    }

    return trimmed;
}

export async function restoreActiveMediaRoute(): Promise<boolean> {
    if (typeof window === 'undefined' || !isNativeMediaBridgeAvailable()) {
        return false;
    }

    const state = await getNativeMediaState();
    const routePath = normalizeRoutePath(state?.sessionContext?.routePath);

    if (!state?.isActive || !routePath) {
        return false;
    }

    const currentUrl = new URL(window.location.href);
    const targetUrl = new URL(routePath, currentUrl.origin);

    if (
        currentUrl.pathname === targetUrl.pathname &&
        currentUrl.search === targetUrl.search &&
        currentUrl.hash === targetUrl.hash
    ) {
        return false;
    }

    router.replace(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);

    return true;
}
