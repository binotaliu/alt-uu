import type { RouteLocationNormalized } from 'vue-router';

/**
 * Above this many rendered material-directory nodes, leaving the
 * courses.show page skips the view transition: snapshotting a very large,
 * unvirtualized directory (with its sticky elements) is the expensive case
 * that makes the transition feel laggy — especially inside a WebView.
 */
export const MATERIAL_DIRECTORY_NODE_THRESHOLD = 150;

/**
 * Courses tab routes in on-screen left-to-right order (matches
 * CoursesTopNav.vue / CoursesBottomNav.vue). Switching between them should
 * slide in the direction implied by their position, not by push/pop history
 * semantics.
 */
const COURSES_TAB_ORDER = [
    'courses.index',
    'courses.live-sessions',
    'courses.school-calendar',
    'courses.account',
];

/**
 * Direction implied by tab position when navigating between two courses tab
 * routes. Returns null when either route isn't one of the tabs, so callers
 * can fall back to history-based direction detection.
 */
export function tabOrderDirection(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
): 'forward' | 'back' | null {
    const fromIndex = COURSES_TAB_ORDER.indexOf(from.name as string);
    const toIndex = COURSES_TAB_ORDER.indexOf(to.name as string);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return null;
    }

    return toIndex > fromIndex ? 'forward' : 'back';
}

/**
 * Whether the browser exposes the View Transitions API. iOS WKWebViews below
 * 18.2 and other older engines return false and simply navigate instantly.
 */
export function supportsViewTransitions(): boolean {
    return typeof document.startViewTransition === 'function';
}

/**
 * Platform detection follows the app convention of body classes set in
 * resources/views/app.blade.php (device-ios / device-android).
 */
export function isAndroidDevice(): boolean {
    return document.body.classList.contains('device-android');
}

export function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Number of material-directory nodes currently rendered in the DOM. Only
 * meaningful while the courses.show page is mounted; returns 0 otherwise.
 */
export function renderedMaterialNodeCount(): number {
    return document.querySelectorAll('[data-material-node]').length;
}

/**
 * Decides whether a navigation should play a view transition. Transitions are
 * disabled on Android (performance), when the API is unavailable, when the
 * user prefers reduced motion, and when leaving a course page whose material
 * directory is large enough to make the snapshot janky.
 */
export function shouldAnimateNavigation(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
): boolean {
    if (!supportsViewTransitions()) {
        return false;
    }

    if (isAndroidDevice()) {
        return false;
    }

    if (prefersReducedMotion()) {
        return false;
    }

    if (
        from.name === 'courses.show' &&
        renderedMaterialNodeCount() > MATERIAL_DIRECTORY_NODE_THRESHOLD
    ) {
        return false;
    }

    // The four courses tab routes all resolve to the same MainScreen
    // instance (see router.ts's shared keepAliveKey), so switching between
    // them never swaps the underlying DOM tree — there's no old/new page to
    // snapshot, and driving a full-page view transition here would just add
    // the beforeResolve/startViewTransition round-trip as pure latency.
    if (tabOrderDirection(to, from) !== null) {
        return false;
    }

    return true;
}
