<script setup lang="ts">
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
            'hidden md:block',
            { 'pointer-events-none': isNavigationLocked },
        ]"
    >
        <div
            class="z-90 mx-auto flex max-w-lg items-center gap-2 rounded-2xl border border-warm-200 bg-white/90 p-1 shadow [view-transition-name:pad-nav] dark:border-zinc-700 dark:bg-zinc-900/90"
        >
            <router-link
                to="/courses"
                @click="activateTab('courses')"
                class="inline-flex flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition"
                :class="{
                    'bg-warm-800 text-white dark:bg-zinc-600':
                        activeTab === 'courses',
                    'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800':
                        activeTab !== 'courses',
                }"
                data-native-transition="lateral"
            >
                我的課程
            </router-link>

            <router-link
                to="/courses/live-sessions"
                @click="activateTab('live-sessions')"
                class="inline-flex flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition"
                :class="{
                    'bg-warm-800 text-white dark:bg-zinc-600':
                        activeTab === 'live-sessions',
                    'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800':
                        activeTab !== 'live-sessions',
                }"
                data-native-transition="lateral"
            >
                視訊面授
            </router-link>

            <router-link
                to="/courses/school-calendar"
                @click="activateTab('school-calendar')"
                class="inline-flex flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition"
                :class="{
                    'bg-warm-800 text-white dark:bg-zinc-600':
                        activeTab === 'school-calendar',
                    'text-warm-700 hover:bg-warm-50 dark:text-zinc-300 dark:hover:bg-zinc-800':
                        activeTab !== 'school-calendar',
                }"
                data-native-transition="lateral"
            >
                學校行事曆
            </router-link>
        </div>
    </nav>
</template>
