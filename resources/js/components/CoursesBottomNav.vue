<script setup lang="ts">
import {
    BriefcaseIcon,
    VideoCameraIcon,
    CalendarDaysIcon,
    UserCircleIcon,
} from '@heroicons/vue/24/outline';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAppConfigStore } from '@/stores/appConfig';

const props = defineProps<{
    activeTab: 'courses' | 'live-sessions' | 'school-calendar' | 'account';
    nouToolsEnabled?: boolean;
}>();

const navElement = ref<HTMLElement | null>(null);
let navResizeObserver: ResizeObserver | null = null;

// The nav grows with the user's text size, so panes reserve scroll space from
// its measured height instead of a fixed rem value.
const publishNavHeight = () => {
    document.documentElement.style.setProperty(
        '--bottom-nav-height',
        `${navElement.value?.offsetHeight ?? 0}px`,
    );
};

onMounted(() => {
    publishNavHeight();
    navResizeObserver = new ResizeObserver(publishNavHeight);

    if (navElement.value) {
        navResizeObserver.observe(navElement.value);
    }
});

onBeforeUnmount(() => {
    navResizeObserver?.disconnect();
    document.documentElement.style.removeProperty('--bottom-nav-height');
});

const showNouToolsModal = ref(false);
const appConfigStore = useAppConfigStore();
const router = useRouter();

// Account identity/subscription is always reachable regardless of the NOU Tools flag, unlike
// live-sessions/school-calendar which require it.
const gatedTabs = ['live-sessions', 'school-calendar'];

const onTabClick = async (
    event: MouseEvent,
    target: 'courses' | 'live-sessions' | 'school-calendar' | 'account',
) => {
    if (!gatedTabs.includes(target)) {
        return;
    }

    // A tap that lands before /api/config resolves would otherwise read the
    // flag's `false` default and prompt a user who already enabled it.
    if (!appConfigStore.isLoaded) {
        event.preventDefault();

        try {
            await appConfigStore.loadConfig();
        } catch {
            // Fall through to the gate below; the flag stays at its default.
        }

        if (appConfigStore.nouToolsIntegrationEnabled) {
            await router.push(`/courses/${target}`);
        } else {
            showNouToolsModal.value = true;
        }

        return;
    }

    if (!props.nouToolsEnabled) {
        event.preventDefault();
        showNouToolsModal.value = true;
    }
};

const enableNouTools = async () => {
    try {
        await appConfigStore.updatePreferences({
            nouToolsIntegrationEnabled: true,
        });

        showNouToolsModal.value = false;
        // Reload the page to reflect the change
        window.location.reload();
    } catch {
        alert('啟用失敗，請稍後重試');
    }
};

const closeModal = () => {
    showNouToolsModal.value = false;
};
</script>

<template>
    <nav
        ref="navElement"
        class="fixed right-0 bottom-0 left-0 z-20 border-t border-theme-200 bg-white px-4 pt-2 pb-[max(var(--inset-bottom,0px),0.75rem)] md:hidden dark:border-zinc-700 dark:bg-zinc-900"
    >
        <div class="mx-auto grid max-w-xl grid-cols-4 gap-2">
            <router-link
                to="/courses"
                @click="onTabClick($event, 'courses')"
                class="inline-flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition md:text-sm"
                :class="{
                    'bg-theme-800 text-white dark:bg-zinc-600':
                        activeTab === 'courses',
                    'text-theme-700 hover:bg-theme-50 dark:text-zinc-300 dark:hover:bg-zinc-800':
                        activeTab !== 'courses',
                }"
            >
                <BriefcaseIcon class="size-6 shrink-0" />
                <span class="line-clamp-2 text-center leading-tight"
                    >我的課程</span
                >
            </router-link>

            <component
                :is="props.nouToolsEnabled ? 'router-link' : 'button'"
                v-bind="
                    props.nouToolsEnabled
                        ? { to: '/courses/live-sessions' }
                        : {}
                "
                @click="onTabClick($event, 'live-sessions')"
                class="inline-flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition md:text-sm"
                :class="{
                    'bg-theme-800 text-white dark:bg-zinc-600':
                        activeTab === 'live-sessions',
                    'text-theme-700 hover:bg-theme-50 dark:text-zinc-300 dark:hover:bg-zinc-800':
                        activeTab !== 'live-sessions',
                }"
            >
                <VideoCameraIcon class="size-6 shrink-0" />
                <span class="line-clamp-2 text-center leading-tight"
                    >視訊面授</span
                >
            </component>

            <component
                :is="props.nouToolsEnabled ? 'router-link' : 'button'"
                v-bind="
                    props.nouToolsEnabled
                        ? { to: '/courses/school-calendar' }
                        : {}
                "
                @click="onTabClick($event, 'school-calendar')"
                class="inline-flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition md:text-sm"
                :class="{
                    'bg-theme-800 text-white dark:bg-zinc-600':
                        activeTab === 'school-calendar',
                    'text-theme-700 hover:bg-theme-50 dark:text-zinc-300 dark:hover:bg-zinc-800':
                        activeTab !== 'school-calendar',
                }"
            >
                <CalendarDaysIcon class="size-6 shrink-0" />
                <span class="line-clamp-2 text-center leading-tight"
                    >學校行事曆</span
                >
            </component>

            <router-link
                to="/courses/account"
                @click="onTabClick($event, 'account')"
                class="inline-flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition md:text-sm"
                :class="{
                    'bg-theme-800 text-white dark:bg-zinc-600':
                        activeTab === 'account',
                    'text-theme-700 hover:bg-theme-50 dark:text-zinc-300 dark:hover:bg-zinc-800':
                        activeTab !== 'account',
                }"
            >
                <UserCircleIcon class="size-6 shrink-0" />
                <span class="line-clamp-2 text-center leading-tight"
                    >我的帳號</span
                >
            </router-link>
        </div>
    </nav>

    <!-- NOU Tools disabled modal -->
    <teleport to="body" v-if="showNouToolsModal">
        <div
            class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black"
        >
            <div
                class="mx-4 rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-800"
            >
                <h3
                    class="mb-2 text-lg font-semibold text-theme-900 dark:text-white"
                >
                    開啟 NOU 小幫手整合
                </h3>
                <p class="mb-6 text-sm text-theme-700 dark:text-zinc-300">
                    此功能需要開啟 NOU 小幫手整合才可使用。
                </p>
                <div class="flex gap-3">
                    <button
                        @click="closeModal"
                        class="flex-1 rounded-lg border border-theme-300 px-4 py-2 text-sm font-medium text-theme-700 transition hover:bg-theme-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                        取消
                    </button>
                    <button
                        @click="enableNouTools"
                        class="flex-1 rounded-lg bg-theme-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-theme-900 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    >
                        開啟
                    </button>
                </div>
            </div>
        </div>
    </teleport>
</template>
