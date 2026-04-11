export type NativeNavigationKind = 'forward' | 'back' | 'lateral';

const NAVIGATION_KIND_ATTRIBUTE = 'data-native-navigation';
const HISTORY_INDEX_KEY = '__altuuNavIndex';

let currentHistoryIndex = 0;
let hasBootstrapped = false;

function readHistoryIndex(state: unknown, fallback: number): number {
    if (typeof state !== 'object' || state === null) {
        return fallback;
    }

    const value = Reflect.get(state, HISTORY_INDEX_KEY);

    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
}

function writeHistoryIndex(nextIndex: number): void {
    const currentState =
        typeof window.history.state === 'object' &&
        window.history.state !== null
            ? (window.history.state as Record<string, unknown>)
            : {};

    window.history.replaceState(
        {
            ...currentState,
            [HISTORY_INDEX_KEY]: nextIndex,
        },
        '',
        window.location.href,
    );

    currentHistoryIndex = nextIndex;
}

function parseNavigationKind(
    value: string | undefined,
): NativeNavigationKind | null {
    if (value === 'forward' || value === 'back' || value === 'lateral') {
        return value;
    }

    return null;
}

function isEligibleAnchor(
    anchor: HTMLAnchorElement,
    event: MouseEvent,
): boolean {
    if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
    ) {
        return false;
    }

    if (anchor.target && anchor.target !== '_self') {
        return false;
    }

    if (anchor.hasAttribute('download')) {
        return false;
    }

    const targetUrl = new URL(anchor.href, window.location.href);
    const currentUrl = new URL(window.location.href);

    if (targetUrl.origin !== currentUrl.origin) {
        return false;
    }

    if (
        targetUrl.pathname === currentUrl.pathname &&
        targetUrl.search === currentUrl.search &&
        targetUrl.hash !== currentUrl.hash
    ) {
        return false;
    }

    return true;
}

function handleDocumentClick(event: MouseEvent): void {
    if (!(event.target instanceof Element)) {
        return;
    }

    const anchor = event.target.closest('a[href]');

    if (!(anchor instanceof HTMLAnchorElement)) {
        return;
    }

    if (!isEligibleAnchor(anchor, event)) {
        return;
    }

    setNextNavigationKind(
        parseNavigationKind(anchor.dataset.nativeTransition) ?? 'forward',
    );
}

function handlePopState(event: PopStateEvent): void {
    const nextIndex = readHistoryIndex(
        event.state,
        Math.max(currentHistoryIndex - 1, 0),
    );

    setNextNavigationKind(nextIndex < currentHistoryIndex ? 'back' : 'forward');
    currentHistoryIndex = nextIndex;
}

export function setNextNavigationKind(kind: NativeNavigationKind): void {
    if (typeof document === 'undefined') {
        return;
    }

    document.documentElement.setAttribute(NAVIGATION_KIND_ATTRIBUTE, kind);
}

export function bootstrapNativePageTransitions(): void {
    if (hasBootstrapped || typeof window === 'undefined') {
        return;
    }

    currentHistoryIndex = readHistoryIndex(window.history.state, 0);
    writeHistoryIndex(currentHistoryIndex);
    setNextNavigationKind('forward');

    document.addEventListener('click', handleDocumentClick, { capture: true });
    window.addEventListener('popstate', handlePopState);

    hasBootstrapped = true;
}

export function commitNativePageVisit(): void {
    if (typeof window === 'undefined') {
        return;
    }

    const stateIndex = readHistoryIndex(window.history.state, Number.NaN);

    if (Number.isFinite(stateIndex)) {
        currentHistoryIndex = stateIndex;

        return;
    }

    writeHistoryIndex(currentHistoryIndex + 1);
}
