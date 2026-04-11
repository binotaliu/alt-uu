<script setup lang="ts">
import {
    BriefcaseIcon,
    VideoCameraIcon,
    CalendarDaysIcon,
} from '@heroicons/vue/24/outline';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
    activeTab: 'courses' | 'live-sessions' | 'school-calendar';
}>();

const localActiveTab = ref<
    'courses' | 'live-sessions' | 'school-calendar' | null
>(null);
const isNavigationLocked = ref(false);

const activeTab = computed(() => localActiveTab.value ?? props.activeTab);

const activateTab = (
    target: 'courses' | 'live-sessions' | 'school-calendar',
) => {
    if (isNavigationLocked.value) {
        return;
    }

    localActiveTab.value = target;
    isNavigationLocked.value = true;
};

watch(
    () => props.activeTab,
    () => {
        localActiveTab.value = null;
        isNavigationLocked.value = false;
    },
);
</script>

<template>
    <nav
        :class="[
            'fixed right-0 bottom-0 left-0 z-20 border-t border-warm-200 bg-white px-4 pt-2 pb-[max(var(--inset-bottom,0px),0.75rem)] [view-transition-name:mobile-bottom-nav] md:hidden dark:border-zinc-700 dark:bg-zinc-900',
            { 'pointer-events-none': isNavigationLocked },
        ]"
    >
        <div class="mx-auto grid max-w-xl grid-cols-3 gap-2">
            <router-link
                to="/courses"
                @click="activateTab('courses')"
                class="inline-flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition md:text-sm"
                :class="{
                    'bg-warm-800 text-white dark:bg-zinc-600':
                        activeTab === 'courses',
                    'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800':
                        activeTab !== 'courses',
                }"
                data-native-transition="lateral"
            >
                <BriefcaseIcon class="size-6" />
                我的課程
            </router-link>

            <router-link
                to="/courses/live-sessions"
                @click="activateTab('live-sessions')"
                class="inline-flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition md:text-sm"
                :class="{
                    'bg-warm-800 text-white dark:bg-zinc-600':
                        activeTab === 'live-sessions',
                    'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800':
                        activeTab !== 'live-sessions',
                }"
                data-native-transition="lateral"
            >
                <VideoCameraIcon class="size-6" />
                視訊面授
            </router-link>

            <router-link
                to="/courses/school-calendar"
                @click="activateTab('school-calendar')"
                class="inline-flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition md:text-sm"
                :class="{
                    'bg-warm-800 text-white dark:bg-zinc-600':
                        activeTab === 'school-calendar',
                    'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800':
                        activeTab !== 'school-calendar',
                }"
                data-native-transition="lateral"
            >
                <CalendarDaysIcon class="size-6" />
                學校行事曆
            </router-link>
        </div>
    </nav>
</template>
