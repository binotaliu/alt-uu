<script setup lang="ts">
import {
    BriefcaseIcon,
    CalendarDaysIcon,
    Cog6ToothIcon,
    UserCircleIcon,
    VideoCameraIcon,
} from '@heroicons/vue/24/outline';
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import AppLayout from '@/components/AppLayout.vue';
import CoursesBottomNav from '@/components/CoursesBottomNav.vue';
import CoursesTopNav from '@/components/CoursesTopNav.vue';
import TransparentPageHeader from '@/components/TransparentPageHeader.vue';
import { useTitle } from '@/composables/useTitle';
import { useWhatsNew } from '@/composables/useWhatsNew';
import { hasUnseenRelease } from '@/lib/releaseNotes';
import AccountPane from '@/pages/Courses/panes/AccountPane.vue';
import CoursesPane from '@/pages/Courses/panes/CoursesPane.vue';
import LiveSessionsPane from '@/pages/Courses/panes/LiveSessionsPane.vue';
import SchoolCalendarPane from '@/pages/Courses/panes/SchoolCalendarPane.vue';
import { useAppConfigStore } from '@/stores/appConfig';

type TabId = 'courses' | 'live-sessions' | 'school-calendar' | 'account';

const route = useRoute();
const configStore = useAppConfigStore();
const { open: openWhatsNew } = useWhatsNew();
const nouToolsEnabled = computed(() =>
    Boolean(configStore.nouToolsIntegrationEnabled),
);

const activeTab = computed(() => route.meta.tab as TabId);

const tabMeta: Record<
    TabId,
    { title: string; icon: typeof BriefcaseIcon; component: unknown }
> = {
    courses: {
        title: '我的課程',
        icon: BriefcaseIcon,
        component: CoursesPane,
    },
    'live-sessions': {
        title: '視訊面授',
        icon: VideoCameraIcon,
        component: LiveSessionsPane,
    },
    'school-calendar': {
        title: '學校行事曆',
        icon: CalendarDaysIcon,
        component: SchoolCalendarPane,
    },
    account: {
        title: '我的帳號',
        icon: UserCircleIcon,
        component: AccountPane,
    },
};

const activePaneComponent = computed(() => tabMeta[activeTab.value].component);

useTitle(computed(() => tabMeta[activeTab.value].title));

// The navs gate live-sessions/school-calendar on the NOU Tools flag, so this
// shell has to load the config itself — the panes behind those tabs can't be
// reached (and can't load it) while the gate is closed.
onMounted(async () => {
    try {
        await Promise.all([
            configStore.loadConfig(),
            configStore.loadPreferences(),
        ]);
    } catch {
        return;
    }

    // Brand-new installs finish onboarding first, which records the current
    // version as seen, so only upgrading users land here.
    if (
        configStore.onboardingCompleted &&
        hasUnseenRelease(
            configStore.appVersion,
            configStore.whatsNewSeenVersion,
        )
    ) {
        openWhatsNew();
    }
});
</script>

<template>
    <AppLayout>
        <TransparentPageHeader :title="tabMeta[activeTab].title">
            <template #nav>
                <CoursesTopNav
                    :active-tab="activeTab"
                    :nou-tools-enabled="nouToolsEnabled"
                />
            </template>
            <template #icon>
                <component
                    :is="tabMeta[activeTab].icon"
                    class="size-5 md:size-6"
                />
            </template>
            <template v-if="activeTab === 'account'" #actions>
                <router-link
                    :to="{ name: 'settings' }"
                    class="inline-flex items-center gap-1 rounded-full border border-theme-300 bg-white px-3 py-1.5 text-sm font-medium text-theme-700 transition hover:border-theme-500 hover:bg-theme-50 md:gap-2 md:px-4 md:py-2 md:text-base dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-400 dark:hover:bg-zinc-700"
                >
                    <Cog6ToothIcon class="size-4 md:size-5" />
                    設定
                </router-link>
            </template>
        </TransparentPageHeader>

        <KeepAlive>
            <component :is="activePaneComponent" />
        </KeepAlive>

        <CoursesBottomNav
            :active-tab="activeTab"
            :nou-tools-enabled="nouToolsEnabled"
        />
    </AppLayout>
</template>
