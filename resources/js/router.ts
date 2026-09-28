import { nextTick } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import {
    shouldAnimateNavigation,
    tabOrderDirection,
} from '@/lib/viewTransitions';

function resolveInitialRoute(): string {
    const w = window as typeof window & {
        showOnboarding?: boolean;
        hasAccounts?: boolean;
    };

    if (w.showOnboarding) {
        return '/onboarding';
    }

    if (!w.hasAccounts) {
        return '/login';
    }

    return '/courses';
}

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        redirect: resolveInitialRoute,
    },
    {
        path: '/login',
        name: 'login',
        component: () => import('@/pages/Auth/Login.vue'),
    },
    {
        path: '/onboarding',
        name: 'onboarding',
        component: () => import('@/pages/Auth/Onboarding.vue'),
    },
    {
        path: '/reauth/:accountId',
        name: 'reauth',
        component: () => import('@/pages/Auth/Reauthenticate.vue'),
        props: true,
    },
    {
        path: '/courses',
        name: 'courses.index',
        component: () => import('@/pages/Courses/MainScreen.vue'),
        meta: { keepAlive: true, keepAliveKey: 'courses-main', tab: 'courses' },
    },
    {
        path: '/courses/live-sessions',
        name: 'courses.live-sessions',
        component: () => import('@/pages/Courses/MainScreen.vue'),
        meta: {
            keepAlive: true,
            keepAliveKey: 'courses-main',
            tab: 'live-sessions',
        },
    },
    {
        path: '/courses/school-calendar',
        name: 'courses.school-calendar',
        component: () => import('@/pages/Courses/MainScreen.vue'),
        meta: {
            keepAlive: true,
            keepAliveKey: 'courses-main',
            tab: 'school-calendar',
        },
    },
    {
        path: '/courses/account',
        name: 'courses.account',
        component: () => import('@/pages/Courses/MainScreen.vue'),
        meta: { keepAlive: true, keepAliveKey: 'courses-main', tab: 'account' },
    },
    {
        path: '/courses/account/accounts',
        name: 'courses.account.accounts',
        component: () => import('@/pages/Account/Accounts.vue'),
    },
    {
        path: '/courses/account/subscription',
        name: 'courses.account.subscription',
        component: () => import('@/pages/Account/Subscription.vue'),
    },
    {
        path: '/courses/account/data-export',
        name: 'courses.account.data-export',
        component: () => import('@/pages/Account/DataExport.vue'),
    },
    {
        path: '/courses/account/grades',
        name: 'courses.account.grades',
        component: () => import('@/pages/Account/Grades.vue'),
    },
    {
        path: '/courses/account/exam-info',
        name: 'courses.account.exam-info',
        component: () => import('@/pages/Account/ExamInfo.vue'),
    },
    {
        path: '/courses/:cid',
        name: 'courses.show',
        component: () => import('@/pages/Courses/Show.vue'),
        props: (route) => ({
            cid: route.params.cid as string,
            tab: route.query.tab as string | undefined,
        }),
    },
    {
        path: '/courses/:cid/discuss/:boardCid/:bid',
        name: 'courses.discuss.board.show',
        component: () => import('@/pages/Courses/DiscussBoard.vue'),
        props: true,
    },
    {
        path: '/courses/:cid/discuss/:boardCid/:bid/:nid',
        name: 'courses.discuss.thread.show',
        component: () => import('@/pages/Courses/DiscussThread.vue'),
        props: true,
    },
    {
        path: '/courses/:cid/:scoid',
        name: 'courses.material.show',
        component: () => import('@/pages/Courses/Material.vue'),
        props: true,
    },
    {
        path: '/settings',
        name: 'settings',
        component: () => import('@/pages/Settings/Index.vue'),
    },
    {
        path: '/settings/diagnostics',
        name: 'settings.diagnostics',
        component: () => import('@/pages/Settings/ConnectivityDiagnostics.vue'),
    },
    {
        path: '/settings/diagnostics/log',
        name: 'settings.diagnostics-log',
        component: () => import('@/pages/Settings/DiagnosticLog.vue'),
    },
    {
        path: '/settings/diagnostics/material',
        name: 'settings.material-source',
        component: () => import('@/pages/Settings/MaterialSource.vue'),
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

// All four courses tab routes now resolve to the same MainScreen chunk, so
// warming it once right after the initial route settles is enough to avoid
// a stall on first entry into /courses.
function prefetchCoursesMainScreen(): void {
    const schedule =
        window.requestIdleCallback?.bind(window) ??
        ((cb: () => void) => window.setTimeout(cb, 200));

    schedule(() => {
        import('@/pages/Courses/MainScreen.vue').catch(() => {});
    });
}

router.isReady().then(prefetchCoursesMainScreen);

// With no scrollBehavior configured, history.scrollRestoration stays 'auto',
// so a history.back()-driven popstate triggers WKWebView's native async
// scroll restoration against the SPA's current (possibly different-height)
// DOM. That race is what leaves sticky/composited elements unpainted until
// the user scrolls manually. Taking scroll restoration over ourselves avoids
// the race entirely.
if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
}

let navigatedViaPopstate = false;

window.addEventListener('popstate', () => {
    navigatedViaPopstate = true;
});

// Set by navigateBack() when it has to fall back to router.replace() (no
// matching history entry to pop). Overrides the popstate-based direction
// detection below so the transition still slides as "back" even though this
// particular navigation isn't a real history pop.
let forcedDirection: 'forward' | 'back' | null = null;

/**
 * Navigate to `path` as a logical "back" action, popping history when the
 * previous entry matches (so the OS/back-swipe history stays sane) and
 * falling back to a replace when it doesn't (e.g. after WebView recovery).
 * Either way, the page transition always slides in the "back" direction.
 */
export function navigateBack(path: string): void {
    const previousPath = window.history.state?.back as string | null;

    if (previousPath === path) {
        window.history.back();
    } else {
        forcedDirection = 'back';
        router.replace(path);
    }
}

// Resolver that lets an in-flight view transition capture the new page and
// finish animating. Held between beforeResolve (where the transition starts)
// and afterEach (where the new page has rendered).
let finishViewTransition: (() => void) | null = null;

function settleViewTransition(): void {
    if (finishViewTransition) {
        const finish = finishViewTransition;
        finishViewTransition = null;
        finish();
    }
}

// Drive the browser View Transitions API from the router. startViewTransition
// snapshots the outgoing page, then its callback releases the navigation so Vue
// swaps <RouterView>; the returned promise is resolved in afterEach once the new
// page has painted, at which point the API captures the new state and animates.
// beforeResolve (not beforeEach) is used so lazy route components are already
// loaded and the new page can render promptly.
router.beforeResolve(async (to, from) => {
    if (!shouldAnimateNavigation(to, from)) {
        forcedDirection = null;

        return;
    }

    // A previous transition that never reached afterEach (e.g. a rapid second
    // navigation) must be released before starting a new one.
    settleViewTransition();

    const direction =
        forcedDirection ??
        tabOrderDirection(to, from) ??
        (navigatedViaPopstate ? 'back' : 'forward');
    forcedDirection = null;

    document.documentElement.dataset.pageTransition = direction;

    // Flush any pending Vue render (e.g. a nav button's optimistic active-tab
    // update from the click that triggered this navigation) so it's part of
    // the DOM the transition snapshots as "old", instead of being captured
    // only once the destination page has already mounted.
    await nextTick();

    return new Promise<void>((resolve) => {
        const transition = document.startViewTransition!(() => {
            resolve();

            return new Promise<void>((done) => {
                finishViewTransition = done;

                // Safety net: if afterEach never fires for this navigation, don't
                // leave the page frozen under the old snapshot. Guard on identity
                // so a stale timer can't cut short a later transition.
                window.setTimeout(() => {
                    if (finishViewTransition === done) {
                        settleViewTransition();
                    }
                }, 500);
            });
        });

        transition.finished.finally(() => {
            delete document.documentElement.dataset.pageTransition;
        });
    });
});

router.afterEach(() => {
    const wasPopstate = navigatedViaPopstate;
    navigatedViaPopstate = false;

    nextTick(() => {
        if (wasPopstate) {
            window.scrollTo(0, 0);
        }

        // Let the freshly swapped page paint before the transition captures the
        // new snapshot, so the scroll reset above is reflected in it.
        requestAnimationFrame(settleViewTransition);
    });
});

export default router;
