import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        redirect: '/auth/booting',
    },
    {
        path: '/login',
        name: 'login',
        component: () => import('@/pages/Auth/Login.vue'),
    },
    {
        path: '/auth/booting',
        name: 'auth.booting',
        component: () => import('@/pages/Auth/Booting.vue'),
    },
    {
        path: '/courses',
        name: 'courses.index',
        component: () => import('@/pages/Courses/Index.vue'),
    },
    {
        path: '/courses/live-sessions',
        name: 'courses.live-sessions',
        component: () => import('@/pages/Courses/LiveSessions.vue'),
    },
    {
        path: '/courses/school-calendar',
        name: 'courses.school-calendar',
        component: () => import('@/pages/Courses/SchoolCalendar.vue'),
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
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
